import fs from "fs";
import path from "path";
import { getNeo4jDriver } from "../src/lib/neo4j";

// Siembra el grafo de compatibilidad (PDF §9.2).
// 1) Aplica constraints de unicidad e índices secundarios (§9.2.4).
// 2) Carga nodos y relaciones desde data/graph.json (opcional; lo arma Alvarez).
//
// Formato esperado de data/graph.json:
// {
//   "nodes": [
//     { "label": "Socket", "props": { "nombre": "AM5", "generacion": 4 } },
//     { "label": "Componente", "props": { "id": "ryzen-5-7600", "nombre": "...", "categoria": "cpu" } }
//   ],
//   "relationships": [
//     { "from": { "label": "Componente", "value": "ryzen-5-7600" },
//       "type": "TIENE_SOCKET",
//       "to":   { "label": "Socket", "value": "AM5" },
//       "props": { "rol": "requiere", "tipoValidacion": "obligatoria" } }
//   ]
// }

// Propiedad-clave única por label (debe coincidir con las constraints).
const KEY: Record<string, string> = {
    Componente: "id",
    Build: "id",
    Socket: "nombre",
    Chipset: "nombre",
    EstandarMemoria: "tipo",
    EstandarBus: "version",
    Advertencia: "id",
};

// Tipos de relación permitidos (el tipo no se puede parametrizar en Cypher).
const REL_TYPES = new Set([
    "TIENE_SOCKET",
    "TIENE_CHIPSET",
    "TIENE_BUS",
    "SOPORTA_MEMORIA",
    "COMPATIBLE_CON",
    "TIENE",
    "COMBINA_FRECUENTEMENTE_CON",
    "APLICA_A",
]);

const CONSTRAINTS = [
    "CREATE CONSTRAINT componente_id IF NOT EXISTS FOR (c:Componente) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT build_id IF NOT EXISTS FOR (b:Build) REQUIRE b.id IS UNIQUE",
    "CREATE CONSTRAINT socket_nombre IF NOT EXISTS FOR (s:Socket) REQUIRE s.nombre IS UNIQUE",
    "CREATE CONSTRAINT chipset_nombre IF NOT EXISTS FOR (ch:Chipset) REQUIRE ch.nombre IS UNIQUE",
    "CREATE CONSTRAINT estandarmemoria_tipo IF NOT EXISTS FOR (em:EstandarMemoria) REQUIRE em.tipo IS UNIQUE",
    "CREATE CONSTRAINT estandarbus_version IF NOT EXISTS FOR (eb:EstandarBus) REQUIRE eb.version IS UNIQUE",
    "CREATE CONSTRAINT advertencia_id IF NOT EXISTS FOR (a:Advertencia) REQUIRE a.id IS UNIQUE",
];

const INDEXES = [
    "CREATE INDEX componente_categoria IF NOT EXISTS FOR (c:Componente) ON (c.categoria)",
    "CREATE INDEX advertencia_severidad IF NOT EXISTS FOR (a:Advertencia) ON (a.severidad)",
];

interface NodeSpec {
    label: string;
    props: Record<string, unknown>;
}
interface RelEndpoint {
    label: string;
    value: unknown;
}
interface RelSpec {
    from: RelEndpoint;
    type: string;
    to: RelEndpoint;
    props?: Record<string, unknown>;
}

function keyFor(label: string): string {
    const k = KEY[label];
    if (!k) throw new Error(`Label desconocido sin clave única: ${label}`);
    return k;
}

async function main() {
    const driver = getNeo4jDriver();
    const session = driver.session();
    try {
        // 1) Constraints e índices (idempotentes).
        for (const stmt of [...CONSTRAINTS, ...INDEXES]) {
            await session.run(stmt);
        }
        console.log(`✓ ${CONSTRAINTS.length} constraints y ${INDEXES.length} índices aplicados.`);

        // 2) Datos del grafo (opcional).
        const graphFile = path.join(process.cwd(), "data", "graph.json");
        if (!fs.existsSync(graphFile)) {
            console.log("- data/graph.json no existe todavía: solo se aplicó el esquema.");
            return;
        }

        const graph = JSON.parse(fs.readFileSync(graphFile, "utf-8")) as {
            nodes?: NodeSpec[];
            relationships?: RelSpec[];
        };

        // Nodos: MERGE por clave única, SET del resto de propiedades.
        for (const node of graph.nodes ?? []) {
            const key = keyFor(node.label);
            await session.run(
                `MERGE (n:${node.label} {${key}: $keyVal}) SET n += $props`,
                { keyVal: node.props[key], props: node.props },
            );
        }
        console.log(`✓ ${graph.nodes?.length ?? 0} nodos cargados.`);

        // Relaciones: MATCH ambos extremos por su clave, MERGE la relación.
        for (const rel of graph.relationships ?? []) {
            if (!REL_TYPES.has(rel.type)) {
                throw new Error(`Tipo de relación no permitido: ${rel.type}`);
            }
            const fromKey = keyFor(rel.from.label);
            const toKey = keyFor(rel.to.label);
            await session.run(
                `
                MATCH (a:${rel.from.label} {${fromKey}: $fromVal})
                MATCH (b:${rel.to.label} {${toKey}: $toVal})
                MERGE (a)-[r:${rel.type}]->(b)
                SET r += $props
                `,
                {
                    fromVal: rel.from.value,
                    toVal: rel.to.value,
                    props: rel.props ?? {},
                },
            );
        }
        console.log(`✓ ${graph.relationships?.length ?? 0} relaciones cargadas.`);
    } finally {
        await session.close();
        await driver.close();
    }
    console.log("Seed de Neo4j terminado.");
}

main().catch((e) => {
    console.error("Error en seed-neo4j:", e);
    process.exit(1);
});
