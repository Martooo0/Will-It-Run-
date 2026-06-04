import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/mongodb";
import { Component, CATEGORIAS } from "@/lib/models/Component";

// EJEMPLO COMPLETO del patrón de API Route documental (PDF §6, motor MongoDB).
// Búsqueda y filtrado de componentes por categoría, marca y texto, con orden.
// Peña extiende este patrón para filtros sobre campos de `specs`.

// 1) Validación de entrada con Zod (PDF §10: "validan la entrada con Zod").
const querySchema = z.object({
    cat: z.enum(CATEGORIAS).optional(),
    brand: z.string().optional(),
    q: z.string().optional(),              // texto libre sobre name
    sort: z.string().optional(),           // campo de orden (ej. "specs.scoreCPU")
    order: z.enum(["asc", "desc"]).default("desc"),
    limit: z.coerce.number().int().positive().max(200).default(50),
});

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Parámetros inválidos", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }
    const { cat, brand, q, sort, order, limit } = parsed.data;

    // 2) Armado del filtro Mongo.
    const filtro: Record<string, unknown> = {};
    if (cat) filtro.cat = cat;
    if (brand) filtro.brand = brand;
    if (q) filtro.name = { $regex: q, $options: "i" };

    // 3) Consulta documental. (Este endpoint no se cachea: el catálogo es
    //    grande y muy variable según filtros; el caché Redis se reserva para
    //    resultados de cómputo costoso, PDF §9.3.)
    await connectMongo();
    const cursor = Component.find(filtro).limit(limit);
    if (sort) cursor.sort({ [sort]: order === "asc" ? 1 : -1 });

    const componentes = await cursor.lean();
    return NextResponse.json({ count: componentes.length, componentes });
}
