import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Ensamble } from "@/lib/models/Ensamble";
import { getBuildsSimilares } from "@/lib/queries/cypher";

const componentesSchema = z.object({
    cpu: z.string().optional(),
    cooler: z.string().optional(),
    motherboard: z.string().optional(),
    memory: z.string().optional(),
    storage: z.string().optional(),
    gpu: z.string().optional(),
    psu: z.string().optional(),
});

const bodySchema = z.object({
    componentes: componentesSchema,
    minEnComun: z.number().int().positive().max(7).default(2),
});

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const similares = await getBuildsSimilares(
        parsed.data.componentes,
        parsed.data.minEnComun,
    );
    const ids = similares.map((s) => s.buildId);

    await connectMongo();
    const docs = await Ensamble.find({ _id: { $in: ids } }).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const builds = similares.map((s) => ({
        enComun: s.enComun,
        build: byId.get(s.buildId) ?? null,
    }));

    return NextResponse.json({ count: builds.length, builds });
}
