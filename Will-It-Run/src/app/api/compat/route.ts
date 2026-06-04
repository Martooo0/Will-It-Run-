import { NextResponse } from "next/server";
import { z } from "zod";
import { cacheAside, keys, TTL } from "@/lib/cache";
import { getAdvertencias, validarBuild } from "@/lib/queries/cypher";
import { SLOTS } from "@/lib/models/Ensamble";

// Validación de compatibilidad de una build (PDF §6, motor Neo4j | Redis).
// Patrón Redis-first: se cachea el resultado de validarBuild para el par
// cpu:motherboard (clave compat:{cpuId}:{moboId}, TTL 1h, PDF §9.3.1).

const slotSchema = z.object(
    Object.fromEntries(SLOTS.map((s) => [s, z.string().optional()])),
);

const bodySchema = z.object({ componentes: slotSchema });

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body inválido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { componentes } = parsed.data;

    const buildHash = SLOTS.map((slot) => componentes[slot] ?? "_").join(":");
    const cacheKey = keys.compat(buildHash);
    const resultado = await cacheAside(cacheKey, TTL.COMPAT, () =>
        validarBuild(componentes).then(async (validacion) => ({
            ok: validacion.ok,
            issues: [...validacion.issues, ...(await getAdvertencias(componentes))],
        })),
    );

    return NextResponse.json(resultado);
}
