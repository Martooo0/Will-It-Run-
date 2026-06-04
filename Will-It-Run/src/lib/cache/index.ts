import { getRedis } from "../redis";
import { keys } from "./keys";

export { keys, TTL } from "./keys";

/**
 * Patrón cache-aside (lazy loading), PDF §9.3 / §11.3.
 * Redis es el primer motor consultado por la API Route: si hay HIT se devuelve
 * lo cacheado; si hay MISS se ejecuta `producer` (Mongo/Neo4j), se guarda con TTL
 * y se devuelve. Redis NO es fuente de verdad: todo es reconstruible.
 *
 * Uso:
 *   const data = await cacheAside(keys.compat(buildHash), TTL.COMPAT, () =>
 *       validarBuild(build));
 */
export async function cacheAside<T>(
    key: string,
    ttlSeconds: number,
    producer: () => Promise<T>,
): Promise<T> {
    const redis = getRedis();

    const cached = await redis.get(key);
    if (cached !== null) {
        return JSON.parse(cached) as T;
    }

    const fresh = await producer();
    await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
    return fresh;
}

// --- Rankings con sorted sets (PDF §9.3.4–9.3.5) ---
// Ejemplo funcional del patrón ZSET. Rodriguez replica esto para componentes
// trending y demás rankings.

/** Suma `by` al score de una build en el ranking del período (ZINCRBY). */
export async function registrarInteraccionBuild(
    periodo: string,
    buildId: string,
    by = 1,
): Promise<void> {
    await getRedis().zincrby(keys.buildsTrending(periodo), by, buildId);
}

/** Top N builds del período, de mayor a menor (ZREVRANGE WITHSCORES). */
export async function getBuildsTrending(
    periodo: string,
    topN = 10,
): Promise<{ buildId: string; score: number }[]> {
    const flat = await getRedis().zrevrange(
        keys.buildsTrending(periodo),
        0,
        topN - 1,
        "WITHSCORES",
    );
    // ioredis devuelve [member, score, member, score, ...]
    const out: { buildId: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
        out.push({ buildId: flat[i], score: Number(flat[i + 1]) });
    }
    return out;
}

/** Suma `by` al score de un componente en el ranking de su categoria. */
export async function registrarInteraccionComponente(
    categoria: string,
    componenteId: string,
    by = 1,
): Promise<void> {
    await getRedis().zincrby(keys.componentesTrending(categoria), by, componenteId);
}

/** Top N componentes de una categoria, de mayor a menor score. */
export async function getComponentesTrending(
    categoria: string,
    topN = 10,
): Promise<{ componenteId: string; score: number }[]> {
    const flat = await getRedis().zrevrange(
        keys.componentesTrending(categoria),
        0,
        topN - 1,
        "WITHSCORES",
    );

    const out: { componenteId: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
        out.push({ componenteId: flat[i], score: Number(flat[i + 1]) });
    }
    return out;
}
