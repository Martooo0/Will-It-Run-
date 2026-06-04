import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component, CATEGORIAS } from "@/lib/models/Component";
import { PERFILES_USO } from "@/lib/models/Ensamble";
import { getComponentesTrending } from "@/lib/cache";
import {
    componentesCompatibles,
    recomendarComponentes,
} from "@/lib/queries/cypher";

// Orquesta Neo4j -> MongoDB -> Redis opcional.
// Neo4j devuelve ids compatibles, Mongo hidrata specs y Redis ordena popularidad.

const querySchema = z.object({
    componenteId: z.string().min(1),
    categoriaObjetivo: z.enum(CATEGORIAS),
    criterio: z.enum(["rendimiento", "popularidad"]).default("rendimiento"),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

const componentesSchema = z.object({
    cpu: z.string().optional(),
    cooler: z.string().optional(),
    motherboard: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
});

const postSchema = z.object({
    componentes: componentesSchema,
    perfilUso: z.enum(PERFILES_USO),
    limit: z.number().int().positive().max(100).default(10),
});

function rendimientoDe(specs: Record<string, unknown> | undefined): number {
    if (!specs) return 0;
    return Number(specs.scoreCPU ?? specs.scoreGPU ?? specs.speed ?? 0);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Parametros invalidos", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { componenteId, categoriaObjetivo, criterio, limit } = parsed.data;

    const ids = await componentesCompatibles(componenteId, categoriaObjetivo);
    if (ids.length === 0) {
        return NextResponse.json({ count: 0, criterio, componentes: [] });
    }

    await connectMongo();
    const docs = await Component.find({ id: { $in: ids } }).lean();

    let popularidad = new Map<string, number>();
    if (criterio === "popularidad") {
        const ranking = await getComponentesTrending(categoriaObjetivo, 200);
        popularidad = new Map(ranking.map((r) => [r.componenteId, r.score]));
    }

    const componentes = docs
        .sort((a, b) => {
            if (criterio === "popularidad") {
                return (popularidad.get(b.id) ?? 0) - (popularidad.get(a.id) ?? 0);
            }
            return (
                rendimientoDe(b.specs as Record<string, unknown>) -
                rendimientoDe(a.specs as Record<string, unknown>)
            );
        })
        .slice(0, limit);

    return NextResponse.json({ count: componentes.length, criterio, componentes });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const { componentes, perfilUso, limit } = parsed.data;
    const ids = (await recomendarComponentes(componentes, perfilUso)).slice(0, limit);
    if (ids.length === 0) {
        return NextResponse.json({ count: 0, componentes: [] });
    }

    await connectMongo();
    const docs = await Component.find({ id: { $in: ids } }).lean();
    const byId = new Map(docs.map((d) => [d.id, d]));
    const recomendados = ids.map((id) => byId.get(id)).filter(Boolean);

    return NextResponse.json({ count: recomendados.length, componentes: recomendados });
}
