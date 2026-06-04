import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component, CATEGORIAS } from "@/lib/models/Component";
import {
    getComponentesTrending,
    registrarInteraccionComponente,
} from "@/lib/cache";

const getSchema = z.object({
    cat: z.enum(CATEGORIAS),
    top: z.coerce.number().int().positive().max(100).default(10),
});

const postSchema = z.object({
    componenteId: z.string().min(1),
    categoria: z.enum(CATEGORIAS),
    incremento: z.number().int().positive().default(1),
});

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const parsed = getSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Parametros invalidos", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const { cat, top } = parsed.data;
    const ranking = await getComponentesTrending(cat, top);
    const ids = ranking.map((r) => r.componenteId);

    await connectMongo();
    const docs = await Component.find({ id: { $in: ids } }).lean();
    const byId = new Map(docs.map((d) => [d.id, d]));
    const componentes = ranking.map((r) => ({
        score: r.score,
        componente: byId.get(r.componenteId) ?? null,
    }));

    return NextResponse.json({ categoria: cat, count: componentes.length, componentes });
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

    const { categoria, componenteId, incremento } = parsed.data;
    await registrarInteraccionComponente(categoria, componenteId, incremento);
    return NextResponse.json({ ok: true });
}
