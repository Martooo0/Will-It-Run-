import fs from "fs";
import path from "path";
import { getRedis } from "../src/lib/redis";
import { keys, TTL } from "../src/lib/cache/keys";

// ============================================================================
//  SNAPSHOT DE DEMOSTRACIÓN de Redis — NO es cómo se llena Redis en producción.
//
//  En la app real, Redis arranca VACÍO y se llena solo (cache-aside / lazy):
//  la API consulta Redis -> si hay miss, consulta Mongo/Neo4j -> cachea el
//  resultado con TTL. Ese mecanismo REAL está en src/lib/cache/index.ts
//  (función cacheAside) y lo usan las API routes (p. ej. src/app/api/compat).
//
//  Pero la demostración del TP se hace consultando DIRECTO en las GUIs
//  (Cypher en Neo4j, find() en Compass), y esas consultas NO pasan por la app,
//  así que el cache-aside no se dispara y Redis quedaría vacío. Por eso este
//  script PRE-CARGA Redis con un snapshot representativo de lo que el cache
//  contendría tras la operación normal, para poder verlo en Redis Insight.
// ============================================================================
//
// Siembra Redis (PDF §9.3) DERIVANDO los datos del dataset ya existente
// (community-builds, builds, components). No crea ningún archivo en data/.
// Reusa la convención de claves de src/lib/cache/keys.ts.
//
// Deja Redis Insight con las 5 estructuras del diseño:
//   - builds:trending:{semana|mes}      (sorted set)  ranking de community builds
//   - componentes:trending:{categoria}  (sorted set)  componentes más usados
//   - buildscore:{buildId}              (hash)        score + tier de algunas builds
//   - compat:{cpuId}:{moboId}           (string+TTL)  cache de validación (2 ejemplos)
//   - advertencias:{buildHash}          (string+TTL)  cache de advertencias (1 ejemplo)
//
// Correr: npm run seed:redis   (o npm run seed:all)

const DATA_DIR = path.join(process.cwd(), "data");

const SLOTS = ["cpu", "cooler", "motherboard", "memory", "storage", "gpu", "psu"] as const;
type Slot = (typeof SLOTS)[number];

interface Componente {
    id: string;
    cat: string;
    specs?: { scoreCPU?: number; scoreGPU?: number; speed?: number };
}
interface Build {
    _id: string;
    componentes?: Partial<Record<Slot, string>>;
    buildScore?: number;
    tier?: string;
}
interface CommunityBuild {
    _id: string;
    build?: Partial<Record<Slot, string>>;
    likes?: number;
    vistas?: number;
}

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8")) as T;
}

const REF_BUILD_ID = "665f00000000000000000001";
const MUESTRA_BUILDSCORE = 5; // cuántas builds cachear como ejemplo

async function main() {
    const components = readJson<Componente[]>("components.json");
    const builds = readJson<Build[]>("builds.json");
    const community = readJson<CommunityBuild[]>("community-builds.json");

    const byId = new Map<string, Componente>(components.map((c) => [c.id, c]));
    const redis = getRedis();

    // --- 1) Ranking de community builds: semana = likes, mes = vistas ---
    const kSemana = keys.buildsTrending("semana");
    const kMes = keys.buildsTrending("mes");

    // --- 2) Componentes más usados por categoría (apariciones en community builds) ---
    const conteoPorCat = new Map<string, Map<string, number>>();
    for (const cb of community) {
        for (const slot of SLOTS) {
            const compId = cb.build?.[slot];
            if (!compId) continue;
            const comp = byId.get(compId);
            if (!comp) continue;
            const cat = comp.cat; // slot "cooler"->cat "cooling", "psu"->"power"
            const mapa = conteoPorCat.get(cat) ?? new Map<string, number>();
            mapa.set(compId, (mapa.get(compId) ?? 0) + 1);
            conteoPorCat.set(cat, mapa);
        }
    }

    // --- 3) buildscore de las primeras N builds ---
    const muestra = builds.slice(0, MUESTRA_BUILDSCORE);

    // --- 4) compat: dos ejemplos reales ---
    const kCompatOk = keys.compat("ryzen-5-7600:b650-tomahawk");
    const kCompatErr = keys.compat("core-i5-14600k:b650-tomahawk");

    // --- 5) advertencias de la build de referencia ---
    const ref = builds.find((b) => b._id === REF_BUILD_ID) ?? builds[0];
    const buildHash = SLOTS.map((s) => ref.componentes?.[s]).filter(Boolean).join(":");
    const kAdvertencias = keys.advertencias(buildHash);

    // --- Idempotencia: borrar SOLO las claves que administra este seed ---
    const administradas: string[] = [
        kSemana,
        kMes,
        ...[...conteoPorCat.keys()].map((cat) => keys.componentesTrending(cat)),
        ...muestra.map((b) => keys.buildscore(b._id)),
        kCompatOk,
        kCompatErr,
        kAdvertencias,
    ];
    if (administradas.length) await redis.del(...administradas);

    // --- Escritura ---
    for (const cb of community) {
        await redis.zadd(kSemana, cb.likes ?? 0, cb._id);
        await redis.zadd(kMes, cb.vistas ?? 0, cb._id);
    }

    for (const [cat, mapa] of conteoPorCat) {
        const key = keys.componentesTrending(cat);
        for (const [compId, count] of mapa) {
            await redis.zadd(key, count, compId);
        }
    }

    for (const b of muestra) {
        const cpu = b.componentes?.cpu ? byId.get(b.componentes.cpu) : undefined;
        const gpu = b.componentes?.gpu ? byId.get(b.componentes.gpu) : undefined;
        const ram = b.componentes?.memory ? byId.get(b.componentes.memory) : undefined;
        const key = keys.buildscore(b._id);
        await redis.hset(key, {
            cpuScore: String(cpu?.specs?.scoreCPU ?? 0),
            gpuScore: String(gpu?.specs?.scoreGPU ?? 0),
            ramSpeed: String(ram?.specs?.speed ?? 0),
            totalScore: String(b.buildScore ?? 0),
            tier: b.tier ?? "",
        });
        await redis.expire(key, TTL.BUILDSCORE);
    }

    await redis.set(kCompatOk, JSON.stringify({ ok: true, issues: [] }), "EX", TTL.COMPAT);
    await redis.set(
        kCompatErr,
        JSON.stringify({ ok: false, issues: [{ sev: "error", campo: "socket", detalle: "LGA1700 != AM5" }] }),
        "EX",
        TTL.COMPAT,
    );

    await redis.set(
        kAdvertencias,
        JSON.stringify([{ id: "gpu-consumo-medio", severidad: "warn" }]),
        "EX",
        TTL.ADVERTENCIAS,
    );

    console.log(`✓ builds:trending:semana / :mes — ${community.length} community builds`);
    console.log(`✓ componentes:trending — ${conteoPorCat.size} categorías`);
    console.log(`✓ buildscore — ${muestra.length} hashes (TTL ${TTL.BUILDSCORE}s)`);
    console.log(`✓ compat — 2 ejemplos; advertencias — 1 ejemplo`);
    console.log("Seed de Redis terminado.");

    await redis.quit();
}

main().catch((e) => {
    console.error("Error en seed-redis:", e);
    process.exit(1);
});
