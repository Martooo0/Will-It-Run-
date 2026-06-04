import { getNeo4jDriver } from "../neo4j";
import type {
    BuildComponentes,
    Categoria,
    Issue,
    PerfilUso,
    ResultadoValidacion,
} from "@/types";

// Queries Cypher del motor de compatibilidad y recomendaciones (PDF §9.2.3).
// Dueño: Alvarez. El wrapper TS (sesión, params, mapeo de resultados) ya está
// resuelto; lo que falta completar es el BODY de cada Cypher marcado con TODO.
//
// Helper de ejecución: abre sesión, corre la query, cierra sesión.
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

/**
 * componentesCompatibles — EJEMPLO FUNCIONAL del patrón.
 * Dado un componente, devuelve los ids de componentes de `categoriaObjetivo`
 * conectados por COMPATIBLE_CON. La API hidrata esos ids con specs desde Mongo
 * y los ordena por rendimiento/popularidad.
 */
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

/**
 * validarBuild — recorre en una sola query TIENE_SOCKET, TIENE_CHIPSET,
 * TIENE_BUS y SOPORTA_MEMORIA, devolviendo la lista de issues con severidad.
 * TODO (Alvarez): completar el Cypher de validación estructural.
 */
export async function validarBuild(
    build: BuildComponentes,
): Promise<ResultadoValidacion> {
    // TODO: implementar el recorrido de compatibilidad. Patrón de partida:
    //   MATCH (cpu:Componente {id:$cpu})-[:TIENE_SOCKET]->(s:Socket)
    //   MATCH (mobo:Componente {id:$mobo})-[:TIENE_SOCKET]->(s2:Socket)
    //   ... comparar s vs s2, chipset, bus (warning por retrocompat), memoria ...
    //   RETURN issue.severidad, issue.title, ...
    void build; // evitar "unused" hasta que se implemente
    const issues: Issue[] = [];
    return { ok: issues.every((i) => i.severidad !== "error"), issues };
}

/**
 * getAdvertencias — rule-matching: qué nodos Advertencia se activan para la
 * build, recorriendo APLICA_A. Las numéricas (powerDraw, tdpCapacity) se
 * combinan con specs de Mongo en la capa de API.
 * TODO (Alvarez): completar el Cypher de rule-matching.
 */
export async function getAdvertencias(
    build: BuildComponentes,
): Promise<Issue[]> {
    void build;
    return [];
}

/**
 * recomendarComponentes — usa COMBINA_FRECUENTEMENTE_CON filtrando por
 * perfilUso y priorizando por frecuencia y ratingPromedio.
 * TODO (Alvarez): completar el Cypher de recomendación.
 */
export async function recomendarComponentes(
    build: BuildComponentes,
    perfilUso: PerfilUso,
): Promise<string[]> {
    void build;
    void perfilUso;
    return [];
}

/**
 * getBuildsSimilares — community builds que comparten al menos N componentes,
 * patrón (b:Build)-[:TIENE]->(c)<-[:TIENE]-(otra:Build).
 * TODO (Alvarez): completar el Cypher de similitud.
 */
export async function getBuildsSimilares(
    build: BuildComponentes,
    n: number,
): Promise<{ buildId: string; enComun: number }[]> {
    void build;
    void n;
    return [];
}
