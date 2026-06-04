import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { CommunityBuild } from "@/lib/models/CommunityBuild";
import { getBuildsTrending, registrarInteraccionBuild } from "@/lib/cache";

// Comunidad (PDF §6): listado de community builds (Mongo) y ranking de
// populares por período (Redis sorted set). Dueño del ranking: Rodriguez.

const getSchema = z.object({
    trending: z.enum(["semana", "mes"]).optional(),
    top: z.coerce.number().int().positive().max(100).default(10),
});

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const parsed = getSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Parámetros inválidos", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { trending, top } = parsed.data;

    await connectMongo();

    // Rama ranking (Redis): ids + score, hidratados con metadatos de Mongo.
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

    // Rama listado documental (Mongo).
    const builds = await CommunityBuild.find().sort({ rating: -1 }).lean();
    return NextResponse.json({ count: builds.length, builds });
}

// Registra una interacción (like/visita) en el ranking del período (ZINCRBY).
const postSchema = z.object({
    buildId: z.string().min(1),
    periodo: z.enum(["semana", "mes"]),
    incremento: z.number().int().positive().default(1),
});

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body inválido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { buildId, periodo, incremento } = parsed.data;
    await registrarInteraccionBuild(periodo, buildId, incremento);
    return NextResponse.json({ ok: true });
}
