import { connectMongo } from "@/lib/mongodb";
import { Component } from "@/lib/models/Component";
import { getAdvertencias } from "@/lib/queries/cypher";
import type { BuildComponentes, Issue, Slot } from "@/types";

type Specs = Record<string, unknown>;

const SLOT_LABELS: Record<Slot, string> = {
    cpu: "CPU",
    cooler: "cooler",
    motherboard: "motherboard",
    memory: "RAM",
    storage: "storage",
    gpu: "GPU",
    psu: "fuente",
};

function numberSpec(specs: Specs | undefined, key: string): number {
    const value = specs?.[key];
    return typeof value === "number" ? value : Number(value ?? 0);
}

function stringSpec(specs: Specs | undefined, key: string): string | undefined {
    const value = specs?.[key];
    return typeof value === "string" ? value : undefined;
}

function warning(
    id: string,
    severidad: Issue["severidad"],
    title: string,
    body: string,
    campoEvaluado: string,
): Issue {
    return { id, severidad, title, body, campoEvaluado };
}

async function specsPorSlot(build: BuildComponentes): Promise<Partial<Record<Slot, Specs>>> {
    const ids = Object.values(build).filter(Boolean) as string[];
    if (ids.length === 0) return {};

    await connectMongo();
    const docs = await Component.find({ id: { $in: ids } }).lean();
    const byId = new Map(docs.map((doc) => [doc.id, doc.specs as Specs]));

    const out: Partial<Record<Slot, Specs>> = {};
    for (const [slot, componentId] of Object.entries(build) as [Slot, string | undefined][]) {
        if (!componentId) continue;
        out[slot] = byId.get(componentId);
    }
    return out;
}

function evaluarMemoria(specs: Partial<Record<Slot, Specs>>): Issue[] {
    const motherboardMem = stringSpec(specs.motherboard, "memType");
    const ramType = stringSpec(specs.memory, "type");
    if (!motherboardMem || !ramType || motherboardMem === ramType) return [];

    return [
        warning(
            "ram-motherboard-memoria-incompatible",
            "error",
            "RAM incompatible con motherboard",
            `La motherboard soporta ${motherboardMem}, pero la RAM seleccionada es ${ramType}.`,
            "memory/motherboard",
        ),
    ];
}

function evaluarFuente(specs: Partial<Record<Slot, Specs>>): Issue[] {
    const watts = numberSpec(specs.psu, "watts");
    if (!watts) return [];

    const consumo =
        numberSpec(specs.cpu, "powerCPU") +
        numberSpec(specs.gpu, "powerGPU") +
        numberSpec(specs.memory, "powerRam") +
        numberSpec(specs.storage, "powerStg") +
        numberSpec(specs.cooler, "powerCooler");

    if (!consumo) return [];

    const margen = watts - consumo;
    const uso = consumo / watts;
    const body = `Consumo estimado: ${consumo}W. Fuente: ${watts}W. Margen: ${margen}W.`;

    if (uso >= 1) {
        return [
            warning(
                "psu-sobrecargada",
                "error",
                "Fuente insuficiente para la build",
                body,
                "psu",
            ),
        ];
    }

    if (uso >= 0.85) {
        return [
            warning(
                "psu-cerca-del-limite",
                "warn",
                "Fuente cerca de su limite",
                body,
                "psu",
            ),
        ];
    }

    return [];
}

function evaluarCooler(specs: Partial<Record<Slot, Specs>>): Issue[] {
    const cpuPower = numberSpec(specs.cpu, "powerCPU");
    const tdpCapacity = numberSpec(specs.cooler, "tdpCapacity");
    if (!cpuPower || !tdpCapacity) return [];

    if (tdpCapacity < cpuPower) {
        return [
            warning(
                "cooler-insuficiente",
                "error",
                "Cooler insuficiente para el procesador",
                `El CPU consume ${cpuPower}W y el cooler disipa hasta ${tdpCapacity}W.`,
                "cooler",
            ),
        ];
    }

    const margenTermico = tdpCapacity / cpuPower;
    if (margenTermico < 1.25) {
        return [
            warning(
                "cooler-margen-bajo",
                "warn",
                "Cooler con poco margen termico",
                `El CPU consume ${cpuPower}W y el cooler disipa ${tdpCapacity}W.`,
                "cooler",
            ),
        ];
    }

    return [];
}

export function buildHash(build: BuildComponentes, slots: readonly Slot[]): string {
    return slots.map((slot) => build[slot] ?? "_").join(":");
}

export async function getAdvertenciasActivas(build: BuildComponentes): Promise<Issue[]> {
    const [advertenciasGrafo, specs] = await Promise.all([
        getAdvertencias(build),
        specsPorSlot(build),
    ]);

    const faltantes = (Object.entries(build) as [Slot, string | undefined][])
        .filter(([slot, componentId]) => componentId && !specs[slot])
        .map(([slot, componentId]) =>
            warning(
                `specs-no-encontradas-${slot}`,
                "warn",
                "Componente sin specs en MongoDB",
                `No se encontraron specs para ${SLOT_LABELS[slot]} (${componentId}).`,
                slot,
            ),
        );

    return [
        ...advertenciasGrafo,
        ...faltantes,
        ...evaluarMemoria(specs),
        ...evaluarFuente(specs),
        ...evaluarCooler(specs),
    ];
}
