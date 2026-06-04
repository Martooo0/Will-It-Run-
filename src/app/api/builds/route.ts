import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Ensamble, PERFILES_USO, GAMAS } from "@/lib/models/Ensamble";
import { replicarBuildEnGrafo } from "@/lib/integration/dualWrite";

// Ensambles (PDF §9.1.2). Las builds se crean/editan en Mongo y se replican en
// el grafo Neo4j (dual-write, PDF §9.2.1). Orquestación: Ferreira.

const componentesSchema = z.object({
    cpu: z.string().optional(),
    cooler: z.string().optional(),
    motherboard: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
});

const createSchema = z.object({
    nombreBuild: z.string().min(1),
    perfilUso: z.enum(PERFILES_USO).optional(),
    gama: z.enum(GAMAS).optional(),
    componentes: componentesSchema,
    esPublica: z.boolean().default(false),
});

export async function GET() {
    await connectMongo();
    const builds = await Ensamble.find({ esPublica: true })
        .sort({ fechaCreacion: -1 })
        .lean();
    return NextResponse.json({ count: builds.length, builds });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body inválido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    // 1) Fuente de verdad: Mongo.
    await connectMongo();
    const ensamble = await Ensamble.create(parsed.data);

    // 2) Dual-write: replicar en el grafo para validación/recomendación.
    //    Si Neo4j falla, la build igual existe en Mongo (se puede re-sincronizar).
    try {
        await replicarBuildEnGrafo({
            id: String(ensamble._id),
            gama: parsed.data.gama,
            perfilUso: parsed.data.perfilUso,
            componentes: parsed.data.componentes,
        });
    } catch (e) {
        console.error("Dual-write a Neo4j falló (build creada en Mongo):", e);
    }

    return NextResponse.json(ensamble, { status: 201 });
}
