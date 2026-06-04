import { getNeo4jDriver } from "../neo4j";
import { SLOTS } from "../models/Ensamble";
import type { BuildComponentes } from "@/types";

// Relación entre bases (PDF §9.2.1, nodo Build): las builds se crean/editan en
// MongoDB y se replican en el grafo (dual-write). Esto habilita validarBuild,
// getBuildsSimilares y demás recorridos del grafo sobre la build.
//
// Dueño de la lógica de grafo: Alvarez. Acá queda el esqueleto de la escritura
// espejo que dispara la API Route tras guardar el Ensamble en Mongo.

export interface BuildGrafo {
    id: string; // _id del Ensamble en Mongo (string)
    gama?: string;
    perfilUso?: string;
    componentes: BuildComponentes;
}

/**
 * Replica una build en Neo4j: MERGE del nodo Build y de sus relaciones TIENE
 * hacia cada Componente ocupado, con la propiedad `slot`.
 */
export async function replicarBuildEnGrafo(build: BuildGrafo): Promise<void> {
    const session = getNeo4jDriver().session();
    try {
        await session.run(
            `
            MERGE (b:Build {id: $id})
            SET b.gama = $gama, b.perfilUso = $perfilUso, b.fechaCreacion = coalesce(b.fechaCreacion, datetime())
            `,
            { id: build.id, gama: build.gama ?? null, perfilUso: build.perfilUso ?? null },
        );

        // Reemplaza las relaciones TIENE para reflejar la edición.
        await session.run(`MATCH (b:Build {id: $id})-[r:TIENE]->() DELETE r`, {
            id: build.id,
        });

        for (const slot of SLOTS) {
            const componenteId = build.componentes[slot];
            if (!componenteId) continue;
            await session.run(
                `
                MATCH (b:Build {id: $id})
                MATCH (c:Componente {id: $componenteId})
                MERGE (b)-[r:TIENE]->(c)
                SET r.slot = $slot
                `,
                { id: build.id, componenteId, slot },
            );
        }
    } finally {
        await session.close();
    }
}

/** Borra el nodo Build y sus relaciones (al eliminar el Ensamble en Mongo). */
export async function eliminarBuildDelGrafo(id: string): Promise<void> {
    const session = getNeo4jDriver().session();
    try {
        await session.run(`MATCH (b:Build {id: $id}) DETACH DELETE b`, { id });
    } finally {
        await session.close();
    }
}
