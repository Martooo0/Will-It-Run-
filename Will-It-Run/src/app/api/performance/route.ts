import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component } from "@/lib/models/Component";
import { cacheAside, keys, TTL } from "@/lib/cache";
import { scoreBuild, type SpecsParaScore } from "@/lib/simulation/scoring";
import { GAMAS, PERFILES_USO } from "@/lib/models/Ensamble";

// Estimación de rendimiento / build score (PDF §6, motor MongoDB | Redis).
// La API hidrata las specs relevantes (cpu, gpu, memory) desde Mongo y delega
// el cálculo a simulation.scoreBuild. Se cachea por buildId (hash buildscore,
// TTL 24h, PDF §9.3.2) cuando la build está persistida.

const bodySchema = z.object({
    buildId: z.string().optional(),
    componentes: z.object({
        cpu: z.string().optional(),
        gpu: z.string().optional(),
        memory: z.string().optional(),
    }),
    gama: z.enum(GAMAS).optional(),
    perfilUso: z.enum(PERFILES_USO).optional(),
});

async function hidratarSpecs(componentes: {
    cpu?: string;
    gpu?: string;
    memory?: string;
}): Promise<SpecsParaScore> {
    await connectMongo();
    const ids = [componentes.cpu, componentes.gpu, componentes.memory].filter(
        Boolean,
    ) as string[];
    const docs = await Component.find({ id: { $in: ids } }).lean();
    const byId = new Map(docs.map((d) => [d.id, d.specs as Record<string, unknown>]));

    return {
        cpuScore: Number(byId.get(componentes.cpu ?? "")?.scoreCPU ?? 0) || undefined,
        gpuScore: Number(byId.get(componentes.gpu ?? "")?.scoreGPU ?? 0) || undefined,
        ramSpeed: Number(byId.get(componentes.memory ?? "")?.speed ?? 0) || undefined,
    };
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body inválido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { buildId, componentes } = parsed.data;

    const producer = async () => scoreBuild(await hidratarSpecs(componentes));

    // Con buildId persistido, se cachea; si es una build efímera, se computa.
    const resultado = buildId
        ? await cacheAside(keys.buildscore(buildId), TTL.BUILDSCORE, producer)
        : await producer();

    return NextResponse.json(resultado);
}
