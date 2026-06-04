import { getNeo4jDriver } from "../neo4j";
import type {
    BuildComponentes,
    Categoria,
    Issue,
    PerfilUso,
    ResultadoValidacion,
} from "@/types";

async function run<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {},
): Promise<T[]> {
    const session = getNeo4jDriver().session();
    try {
        const res = await session.run(cypher, params);
        return res.records.map((r) => r.toObject() as T);
    } finally {
        await session.close();
    }
}

function neoNumber(value: unknown): number {
    if (
        typeof value === "object" &&
        value !== null &&
        "toNumber" in value &&
        typeof value.toNumber === "function"
    ) {
        return value.toNumber();
    }
    return Number(value);
}

function issue(
    severidad: Issue["severidad"],
    title: string,
    body?: string,
    campoEvaluado?: string,
): Issue {
    return { severidad, title, body, campoEvaluado };
}

function describirValores(
    nombreA: string,
    valoresA: string[],
    nombreB: string,
    valoresB: string[],
) {
    return `${nombreA}: ${valoresA.join(", ") || "sin dato"} | ${nombreB}: ${
        valoresB.join(", ") || "sin dato"
    }`;
}

const CATEGORIA_ESPERADA: Record<string, Categoria> = {
    cpu: "cpu",
    cooler: "cooling",
    motherboard: "motherboard",
    memory: "memory",
    storage: "storage",
    gpu: "gpu",
    psu: "power",
};

interface Comparacion {
    compatible: boolean;
    aValues: string[];
    bValues: string[];
}

async function compartenSocket(aId: string, bId: string): Promise<Comparacion> {
    const rows = await run<Comparacion>(
        `
        MATCH (a:Componente {id: $aId})
        MATCH (b:Componente {id: $bId})
        OPTIONAL MATCH (a)-[:TIENE_SOCKET]->(aSocket:Socket)
        OPTIONAL MATCH (b)-[:TIENE_SOCKET]->(bSocket:Socket)
        WITH
            [x IN collect(DISTINCT aSocket.nombre) WHERE x IS NOT NULL] AS aValues,
            [x IN collect(DISTINCT bSocket.nombre) WHERE x IS NOT NULL] AS bValues
        RETURN any(x IN aValues WHERE x IN bValues) AS compatible, aValues, bValues
        `,
        { aId, bId },
    );
    return rows[0] ?? { compatible: false, aValues: [], bValues: [] };
}

async function compartenMemoria(
    motherboardId: string,
    memoryId: string,
): Promise<Comparacion> {
    const rows = await run<Comparacion>(
        `
        MATCH (mobo:Componente {id: $motherboardId})
        MATCH (mem:Componente {id: $memoryId})
        OPTIONAL MATCH (mobo)-[:SOPORTA_MEMORIA]->(moboMem:EstandarMemoria)
        OPTIONAL MATCH (mem)-[:SOPORTA_MEMORIA]->(ramMem:EstandarMemoria)
        WITH
            [x IN collect(DISTINCT moboMem.tipo) WHERE x IS NOT NULL] AS aValues,
            [x IN collect(DISTINCT ramMem.tipo) WHERE x IS NOT NULL] AS bValues
        RETURN any(x IN aValues WHERE x IN bValues) AS compatible, aValues, bValues
        `,
        { motherboardId, memoryId },
    );
    return rows[0] ?? { compatible: false, aValues: [], bValues: [] };
}

async function compartenBus(
    motherboardId: string,
    componentId: string,
): Promise<Comparacion> {
    const rows = await run<Comparacion>(
        `
        MATCH (mobo:Componente {id: $motherboardId})
        MATCH (component:Componente {id: $componentId})
        OPTIONAL MATCH (mobo)-[:TIENE_BUS]->(moboBus:EstandarBus)
        OPTIONAL MATCH (component)-[:TIENE_BUS]->(componentBus:EstandarBus)
        WITH
            [x IN collect(DISTINCT moboBus.version) WHERE x IS NOT NULL] AS aValues,
            [x IN collect(DISTINCT componentBus.version) WHERE x IS NOT NULL] AS bValues
        RETURN any(x IN aValues WHERE x IN bValues) AS compatible, aValues, bValues
        `,
        { motherboardId, componentId },
    );
    return rows[0] ?? { compatible: false, aValues: [], bValues: [] };
}

async function existeRelacionCompatible(aId: string, bId: string): Promise<boolean> {
    const rows = await run<{ compatible: boolean }>(
        `
        MATCH (a:Componente {id: $aId})
        MATCH (b:Componente {id: $bId})
        RETURN EXISTS { MATCH (a)-[:COMPATIBLE_CON]-(b) } AS compatible
        `,
        { aId, bId },
    );
    return rows[0]?.compatible ?? false;
}

export async function componentesCompatibles(
    componenteId: string,
    categoriaObjetivo: Categoria,
): Promise<string[]> {
    const rows = await run<{ id: string }>(
        `
        MATCH (c:Componente {id: $componenteId})-[:COMPATIBLE_CON]-(otro:Componente)
        WHERE otro.categoria = $categoriaObjetivo
        RETURN DISTINCT otro.id AS id
        `,
        { componenteId, categoriaObjetivo },
    );
    return rows.map((r) => r.id);
}

export async function validarBuild(
    build: BuildComponentes,
): Promise<ResultadoValidacion> {
    const issues: Issue[] = [];
    const entries = Object.entries(build).filter(([, id]) => Boolean(id)) as [
        string,
        string,
    ][];

    if (entries.length === 0) {
        return { ok: true, issues };
    }

    const ids = entries.map(([, id]) => id);
    const rows = await run<{ id: string; categoria: Categoria | null }>(
        `
        UNWIND $ids AS id
        OPTIONAL MATCH (c:Componente {id: id})
        RETURN id, c.categoria AS categoria
        `,
        { ids },
    );
    const categoriaPorId = new Map(rows.map((r) => [r.id, r.categoria]));

    for (const [slot, id] of entries) {
        const categoria = categoriaPorId.get(id);
        if (!categoria) {
            issues.push(
                issue(
                    "error",
                    "Componente inexistente en grafo",
                    `No existe un nodo Componente con id ${id}.`,
                    slot,
                ),
            );
            continue;
        }

        const esperada = CATEGORIA_ESPERADA[slot];
        if (esperada && categoria !== esperada) {
            issues.push(
                issue(
                    "error",
                    "Categoria incorrecta para el slot",
                    `El slot ${slot} espera ${esperada}, pero ${id} es ${categoria}.`,
                    slot,
                ),
            );
        }
    }

    if (build.cpu && build.motherboard) {
        const r = await compartenSocket(build.cpu, build.motherboard);
        if (!r.compatible) {
            issues.push(
                issue(
                    "error",
                    "CPU y motherboard incompatibles",
                    describirValores("CPU sockets", r.aValues, "Motherboard sockets", r.bValues),
                    "cpu/motherboard",
                ),
            );
        }
    }

    if (build.cpu && build.cooler) {
        const r = await compartenSocket(build.cpu, build.cooler);
        if (!r.compatible) {
            issues.push(
                issue(
                    "error",
                    "Cooler incompatible con CPU",
                    describirValores("CPU sockets", r.aValues, "Cooler sockets", r.bValues),
                    "cooler",
                ),
            );
        }
    }

    if (build.motherboard && build.memory) {
        const r = await compartenMemoria(build.motherboard, build.memory);
        if (!r.compatible) {
            issues.push(
                issue(
                    "error",
                    "Memoria incompatible con motherboard",
                    describirValores("Motherboard memoria", r.aValues, "RAM memoria", r.bValues),
                    "memory",
                ),
            );
        }
    }

    if (build.motherboard && build.gpu) {
        const r = await compartenBus(build.motherboard, build.gpu);
        if (!r.compatible) {
            issues.push(
                issue(
                    "error",
                    "GPU incompatible con motherboard",
                    describirValores("Motherboard buses", r.aValues, "GPU buses", r.bValues),
                    "gpu",
                ),
            );
        }
    }

    if (build.motherboard && build.storage) {
        const r = await compartenBus(build.motherboard, build.storage);
        if (!r.compatible) {
            issues.push(
                issue(
                    "error",
                    "Storage incompatible con motherboard",
                    describirValores("Motherboard buses", r.aValues, "Storage buses", r.bValues),
                    "storage",
                ),
            );
        }
    }

    if (build.gpu && build.psu) {
        const compatible = await existeRelacionCompatible(build.gpu, build.psu);
        if (!compatible) {
            issues.push(
                issue(
                    "warn",
                    "PSU no validada para la GPU",
                    "No existe una relacion COMPATIBLE_CON entre la GPU y la fuente.",
                    "psu",
                ),
            );
        }
    }

    return { ok: issues.every((i) => i.severidad !== "error"), issues };
}

export async function getAdvertencias(
    build: BuildComponentes,
): Promise<Issue[]> {
    const ids = Object.values(build).filter(Boolean) as string[];
    if (ids.length === 0) return [];

    const rows = await run<{
        id: string;
        severidad: Issue["severidad"];
        title: string;
        body?: string;
        componenteId: string;
    }>(
        `
        MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente)
        WHERE c.id IN $ids
        RETURN
            a.id AS id,
            coalesce(a.severidad, "warn") AS severidad,
            a.title AS title,
            a.body AS body,
            c.id AS componenteId
        ORDER BY a.severidad DESC, a.id ASC
        `,
        { ids },
    );

    return rows.map((r) => ({
        id: r.id,
        severidad: r.severidad,
        title: r.title,
        body: r.body,
        campoEvaluado: r.componenteId,
    }));
}

export async function recomendarComponentes(
    build: BuildComponentes,
    perfilUso: PerfilUso,
): Promise<string[]> {
    const ids = Object.values(build).filter(Boolean) as string[];
    if (ids.length === 0) return [];

    const rows = await run<{ id: string }>(
        `
        MATCH (base:Componente)-[r:COMBINA_FRECUENTEMENTE_CON]-(rec:Componente)
        WHERE base.id IN $ids
          AND NOT rec.id IN $ids
          AND (r.perfilUso IS NULL OR r.perfilUso = $perfilUso)
        WITH
            rec,
            sum(coalesce(r.frecuencia, 1)) AS frecuencia,
            avg(coalesce(r.ratingPromedio, 0)) AS ratingPromedio
        RETURN rec.id AS id
        ORDER BY frecuencia DESC, ratingPromedio DESC, rec.id ASC
        LIMIT 10
        `,
        { ids, perfilUso },
    );

    return rows.map((r) => r.id);
}

export async function getBuildsSimilares(
    build: BuildComponentes,
    n: number,
): Promise<{ buildId: string; enComun: number }[]> {
    const ids = Object.values(build).filter(Boolean) as string[];
    if (ids.length === 0) return [];

    const rows = await run<{ buildId: string; enComun: unknown }>(
        `
        MATCH (otra:Build)-[:TIENE]->(c:Componente)
        WHERE c.id IN $ids
        WITH otra, count(DISTINCT c) AS enComun
        WHERE enComun >= $n
        RETURN otra.id AS buildId, enComun
        ORDER BY enComun DESC, otra.id ASC
        LIMIT 10
        `,
        { ids, n },
    );

    return rows.map((r) => ({
        buildId: r.buildId,
        enComun: neoNumber(r.enComun),
    }));
}
