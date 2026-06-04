import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Review, TARGET_TYPES, TIPOS_REVIEW } from "@/lib/models/Review";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const updateSchema = z
    .object({
        tipo: z.enum(TIPOS_REVIEW).optional(),
        targetId: z.string().min(1).optional(),
        targetType: z.enum(TARGET_TYPES).optional(),
        autor: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        comentario: z.string().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Enviar al menos un campo para actualizar",
    });

function validarMongoId(id: string) {
    return mongoose.isValidObjectId(id);
}

export async function GET(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    await connectMongo();
    const review = await Review.findById(id).lean();
    if (!review) {
        return NextResponse.json({ error: "Review no encontrada" }, { status: 404 });
    }

    return NextResponse.json(review);
}

export async function PATCH(req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    await connectMongo();
    const review = await Review.findByIdAndUpdate(
        id,
        { $set: parsed.data },
        { new: true, runValidators: true },
    ).lean();

    if (!review) {
        return NextResponse.json({ error: "Review no encontrada" }, { status: 404 });
    }

    return NextResponse.json(review);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    await connectMongo();
    const review = await Review.findByIdAndDelete(id).lean();
    if (!review) {
        return NextResponse.json({ error: "Review no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deletedId: id });
}
