// Tipos compartidos entre la capa de API, queries y simulación.

import type { SLOTS, PERFILES_USO, GAMAS, TIERS } from "@/lib/models/Ensamble";
import type { CATEGORIAS } from "@/lib/models/Component";

export type Categoria = (typeof CATEGORIAS)[number];
export type Slot = (typeof SLOTS)[number];
export type PerfilUso = (typeof PERFILES_USO)[number];
export type Gama = (typeof GAMAS)[number];
export type Tier = (typeof TIERS)[number];

// Build de entrada para validación/scoring: cada slot -> id de componente.
export type BuildComponentes = Partial<Record<Slot, string>>;

export type Severidad = "info" | "warn" | "error";

// Issue de compatibilidad o advertencia devuelta por el grafo.
export interface Issue {
    id?: string;
    severidad: Severidad;
    title: string;
    body?: string;
    campoEvaluado?: string;
}

// Resultado de validarBuild.
export interface ResultadoValidacion {
    ok: boolean;
    issues: Issue[];
}

// Resultado de scoreBuild.
export interface BuildScore {
    cpuScore?: number;
    gpuScore?: number;
    ramSpeed?: number;
    totalScore: number;
    tier: Tier;
    bottleneck: "cpu-bound" | "gpu-bound" | "balanced";
}
