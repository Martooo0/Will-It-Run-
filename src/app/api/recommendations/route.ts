import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component, CATEGORIAS } from "@/lib/models/Component";
import { componentesCompatibles } from "@/lib/queries/cypher";

// EJEMPLO de orquestación Neo4j -> MongoDB (PDF §6 "componentes compatibles").
// Neo4j devuelve los ids compatibles; la API los hidrata con specs desde Mongo
// y los ordena por el criterio pedido.

const querySchema = z.object({
    componenteId: z.string().min(1),
    categoriaObjetivo: z.enum(CATEGORIAS),
    criterio: z.enum(["rendimiento", "popularidad"]).default("rendimiento"),
});

// score de rendimiento "genérico" según la categoría (ejemplo).
function rendimientoDe(specs: Record<string, unknown> | undefined): number {
    if (!specs) return 0;
    return Number(specs.scoreCPU ?? specs.scoreGPU ?? specs.speed ?? 0);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Parámetros inválidos", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { componenteId, categoriaObjetivo, criterio } = parsed.data;

    // 1) Neo4j: ids compatibles de la categoría objetivo.
    const ids = await componentesCompatibles(componenteId, categoriaObjetivo);
    if (ids.length === 0) {
        return NextResponse.json({ count: 0, componentes: [] });
    }

    // 2) Mongo: hidratar specs.
    await connectMongo();
    const docs = await Component.find({ id: { $in: ids } }).lean();

    // 3) Orden. "popularidad" se resolvería con el ZSET componentes:trending
    //    (Redis); acá queda por rendimiento como ejemplo.
    // TODO (Rodriguez): rama "popularidad" leyendo el sorted set.
    const componentes = docs.sort(
        (a, b) =>
            rendimientoDe(b.specs as Record<string, unknown>) -
            rendimientoDe(a.specs as Record<string, unknown>),
    );

    return NextResponse.json({ count: componentes.length, criterio, componentes });
}
