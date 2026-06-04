import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component, CATEGORIAS } from "@/lib/models/Component";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const updateSchema = z
    .object({
        name: z.string().min(1).optional(),
        brand: z.string().optional(),
        cat: z.enum(CATEGORIAS).optional(),
        badge: z.string().optional(),
        descripcion: z.string().optional(),
        specs: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Enviar al menos un campo para actualizar",
    });

export async function GET(_req: Request, { params }: RouteContext) {
    const { id } = await params;

    await connectMongo();
    const componente = await Component.findOne({ id }).lean();
    if (!componente) {
        return NextResponse.json(
            { error: "Componente no encontrado" },
            { status: 404 },
        );
    }

    return NextResponse.json(componente);
}

export async function PATCH(req: Request, { params }: RouteContext) {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    await connectMongo();
    const componente = await Component.findOneAndUpdate(
        { id },
        { $set: parsed.data },
        { new: true, runValidators: true },
    ).lean();

    if (!componente) {
        return NextResponse.json(
            { error: "Componente no encontrado" },
            { status: 404 },
        );
    }

    return NextResponse.json(componente);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
    const { id } = await params;

    await connectMongo();
    const componente = await Component.findOneAndDelete({ id }).lean();
    if (!componente) {
        return NextResponse.json(
            { error: "Componente no encontrado" },
            { status: 404 },
        );
    }

    return NextResponse.json({ ok: true, deletedId: id });
}
