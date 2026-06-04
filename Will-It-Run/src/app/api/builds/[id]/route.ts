import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Ensamble, GAMAS, PERFILES_USO, TIERS } from "@/lib/models/Ensamble";
import { eliminarBuildDelGrafo, replicarBuildEnGrafo } from "@/lib/integration/dualWrite";
import { getRedis } from "@/lib/redis";
import { keys } from "@/lib/cache";
import type { BuildComponentes } from "@/types";

type RouteContext = {
    params: Promise<{ id: string }>;
};

const componentesSchema = z.object({
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
        nombreBuild: z.string().min(1).optional(),
        perfilUso: z.enum(PERFILES_USO).optional(),
        gama: z.enum(GAMAS).optional(),
        componentes: componentesSchema.optional(),
        buildScore: z.number().optional(),
        tier: z.enum(TIERS).optional(),
        powerDraw: z.number().optional(),
        esPublica: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Enviar al menos un campo para actualizar",
    });

function validarMongoId(id: string) {
    return mongoose.isValidObjectId(id);
}

async function borrarCacheBuild(id: string) {
    try {
        await getRedis().del(keys.buildscore(id));
    } catch (e) {
        console.error("No se pudo invalidar cache de buildscore:", e);
    }
}

async function replicarSiSePuede(build: {
    _id: unknown;
    gama?: string;
    perfilUso?: string;
    componentes?: BuildComponentes;
}) {
    try {
        await replicarBuildEnGrafo({
            id: String(build._id),
            gama: build.gama,
            perfilUso: build.perfilUso,
            componentes: build.componentes ?? {},
        });
    } catch (e) {
        console.error("Dual-write a Neo4j fallo:", e);
    }
}

export async function GET(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    await connectMongo();
    const build = await Ensamble.findById(id).lean();
    if (!build) {
        return NextResponse.json({ error: "Build no encontrada" }, { status: 404 });
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
    const { componentes, ...campos } = parsed.data;
    for (const [key, value] of Object.entries(campos)) {
        if (value !== undefined) update[key] = value;
    }
    for (const [slot, componenteId] of Object.entries(componentes ?? {})) {
        if (componenteId !== undefined) {
            update[`componentes.${slot}`] = componenteId;
        }
    }

    await connectMongo();
    const build = await Ensamble.findByIdAndUpdate(
        id,
        { $set: update },
        { new: true, runValidators: true },
    ).lean();

    if (!build) {
        return NextResponse.json({ error: "Build no encontrada" }, { status: 404 });
    }

    await borrarCacheBuild(id);
    await replicarSiSePuede(build);
    return NextResponse.json(build);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    if (!validarMongoId(id)) {
        return NextResponse.json({ error: "Id invalido" }, { status: 400 });
    }

    await connectMongo();
    const build = await Ensamble.findByIdAndDelete(id).lean();
    if (!build) {
        return NextResponse.json({ error: "Build no encontrada" }, { status: 404 });
    }

    await borrarCacheBuild(id);
    try {
        await eliminarBuildDelGrafo(id);
    } catch (e) {
        console.error("No se pudo borrar build en Neo4j:", e);
    }

    return NextResponse.json({ ok: true, deletedId: id });
}
