import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { CommunityBuild } from "@/lib/models/CommunityBuild";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const buildSlotsSchema = z.object({
    cpu: z.string().optional(),
    cooler: z.string().optional(),
    motherboard: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
});

const updateSchema = z
    .object({
        title: z.string().min(1).optional(),
        autor: z.string().optional(),
        rating: z.number().min(0).max(5).optional(),
        reviews: z.number().int().min(0).optional(),
        note: z.string().optional(),
        build: buildSlotsSchema.optional(),
        likes: z.number().int().min(0).optional(),
        vistas: z.number().int().min(0).optional(),
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
    const build = await CommunityBuild.findById(id).lean();
    if (!build) {
        return NextResponse.json(
            { error: "Community build no encontrada" },
            { status: 404 },
        );
    }

    return NextResponse.json(build);
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

    const update: Record<string, unknown> = {};
    const { build: slots, ...campos } = parsed.data;
    for (const [key, value] of Object.entries(campos)) {
        if (value !== undefined) update[key] = value;
    }
    for (const [slot, componenteId] of Object.entries(slots ?? {})) {
        if (componenteId !== undefined) {
            update[`build.${slot}`] = componenteId;
        }
    }

    await connectMongo();
    const build = await CommunityBuild.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true },
    ).lean();

    if (!build) {
        return NextResponse.json(
            { error: "Community build no encontrada" },
            { status: 404 },
        );
    }

    return NextResponse.json(build);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    await connectMongo();
    const build = await CommunityBuild.findByIdAndDelete(id).lean();
    if (!build) {
        return NextResponse.json(
            { error: "Community build no encontrada" },
            { status: 404 },
        );
    }

    return NextResponse.json({ ok: true, deletedId: id });
}
