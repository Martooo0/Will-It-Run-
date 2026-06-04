import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Review, TARGET_TYPES, TIPOS_REVIEW } from "@/lib/models/Review";

const getSchema = z.object({
    tipo: z.enum(TIPOS_REVIEW).optional(),
    targetType: z.enum(TARGET_TYPES).optional(),
    targetId: z.string().optional(),
    autor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

const createSchema = z.object({
    tipo: z.enum(TIPOS_REVIEW),
    targetId: z.string().min(1),
    targetType: z.enum(TARGET_TYPES),
    autor: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    comentario: z.string().optional(),
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

    const { limit, ...filtros } = parsed.data;
    const filtro = Object.fromEntries(
        Object.entries(filtros).filter(([, value]) => value !== undefined),
    );

    await connectMongo();
    const reviews = await Review.find(filtro)
        .sort({ fechaCreacion: -1 })
        .limit(limit)
        .lean();

    return NextResponse.json({ count: reviews.length, reviews });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    await connectMongo();
    const review = await Review.create(parsed.data);
    return NextResponse.json(review, { status: 201 });
}
