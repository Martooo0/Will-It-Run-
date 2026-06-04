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

const createSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    brand: z.string().optional(),
    cat: z.enum(CATEGORIAS),
    badge: z.string().optional(),
    descripcion: z.string().optional(),
    specs: z.record(z.string(), z.unknown()).default({}),
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

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Body invalido", detalles: parsed.error.flatten() },
            { status: 400 },
        );
    }

    try {
        await connectMongo();
        const componente = await Component.create(parsed.data);
        return NextResponse.json(componente, { status: 201 });
    } catch (e) {
        if (typeof e === "object" && e !== null && "code" in e && e.code === 11000) {
            return NextResponse.json(
                { error: "Ya existe un componente con ese id" },
                { status: 409 },
            );
        }
        console.error("Error creando componente:", e);
        return NextResponse.json(
            { error: "No se pudo crear el componente" },
            { status: 500 },
        );
    }
}
