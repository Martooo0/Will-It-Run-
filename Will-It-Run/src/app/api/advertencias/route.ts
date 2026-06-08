import { NextResponse } from "next/server";
import { z } from "zod";
import { cacheAside, keys, TTL } from "@/lib/cache";
import { SLOTS } from "@/lib/models/Ensamble";
import { buildHash, getAdvertenciasActivas } from "@/lib/warnings/activeWarnings";

const slotSchema = z.object(
    Object.fromEntries(SLOTS.map((slot) => [slot, z.string().optional()])),
);

const bodySchema = z.object({ componentes: slotSchema });

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const { componentes } = parsed.data;
    const hash = buildHash(componentes, SLOTS);
    const cacheKey = keys.advertencias(hash);
    const issues = await cacheAside(cacheKey, TTL.ADVERTENCIAS, () =>
        getAdvertenciasActivas(componentes),
    );

    return NextResponse.json({
        buildHash: hash,
        cacheKey,
        count: issues.length,
        issues,
    });
}
