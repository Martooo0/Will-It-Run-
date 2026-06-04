import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { CommunityBuild } from "@/lib/models/CommunityBuild";
import { getBuildsTrending, registrarInteraccionBuild } from "@/lib/cache";

// Listado de community builds (Mongo) y ranking de populares (Redis ZSET).

const getSchema = z.object({
    trending: z.enum(["semana", "mes"]).optional(),
    top: z.coerce.number().int().positive().max(100).default(10),
    autor: z.string().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
});

const buildSlotsSchema = z.object({
    cpu: z.string().optional(),
    cooler: z.string().optional(),
    motherboard: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
});

const interactionSchema = z.object({
    buildId: z.string().min(1),
    periodo: z.enum(["semana", "mes"]),
    incremento: z.number().int().positive().default(1),
});

const createSchema = z.object({
    title: z.string().min(1),
    autor: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    reviews: z.number().int().min(0).default(0),
    note: z.string().optional(),
    build: buildSlotsSchema,
    likes: z.number().int().min(0).default(0),
    vistas: z.number().int().min(0).default(0),
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
    const { trending, top, autor, minRating } = parsed.data;

    await connectMongo();

    if (trending) {
        const ranking = await getBuildsTrending(trending, top);
        const ids = ranking.map((r) => r.buildId);
        const docs = await CommunityBuild.find({ _id: { $in: ids } }).lean();
        const byId = new Map(docs.map((d) => [String(d._id), d]));
        const builds = ranking.map((r) => ({
            score: r.score,
            build: byId.get(r.buildId) ?? null,
        }));
        return NextResponse.json({ periodo: trending, count: builds.length, builds });
    }

    const filtro: Record<string, unknown> = {};
    if (autor) filtro.autor = autor;
    if (minRating !== undefined) filtro.rating = { $gte: minRating };

    const builds = await CommunityBuild.find(filtro).sort({ rating: -1 }).lean();
    return NextResponse.json({ count: builds.length, builds });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);

    const interaction = interactionSchema.safeParse(body);
    if (interaction.success) {
        const { buildId, periodo, incremento } = interaction.data;
        await registrarInteraccionBuild(periodo, buildId, incremento);
        return NextResponse.json({ ok: true });
    }

    const created = createSchema.safeParse(body);
    if (!created.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: created.error.flatten() },
            { status: 400 },
        );
    }

    await connectMongo();
    const build = await CommunityBuild.create(created.data);
    return NextResponse.json(build, { status: 201 });
}
