import mongoose from "mongoose";

// Ensambles (builds) armados en la plataforma (PDF §9.1.2).
// `componentes` referencia cada slot por el `id` del Component.
// Al crear/editar acá, se replica en el grafo Neo4j (dual-write).

export const SLOTS = [
    "cpu",
    "cooler",
    "motherboard",
    "memory",
    "storage",
    "gpu",
    "psu",
] as const;

export const PERFILES_USO = ["gaming", "creative", "architecture"] as const;
export const GAMAS = ["baja", "media", "alta"] as const;
export const TIERS = ["S", "A", "B", "C", "D"] as const;

const ensambleSchema = new mongoose.Schema({
    nombreBuild: { type: String, required: true },
    fechaCreacion: { type: Date, default: Date.now },
    perfilUso: { type: String, enum: PERFILES_USO },
    gama: { type: String, enum: GAMAS },
    // slot -> id del componente (string). Parcial o completa.
    componentes: {
        cpu: String,
        cooler: String,
        motherboard: String,
        memory: String,
        storage: String,
        gpu: String,
        psu: String,
    },
    buildScore: Number,
    tier: { type: String, enum: TIERS },
    powerDraw: Number,
    esPublica: { type: Boolean, default: false },
});

export const Ensamble =
    mongoose.models.Ensamble || mongoose.model("Ensamble", ensambleSchema);
