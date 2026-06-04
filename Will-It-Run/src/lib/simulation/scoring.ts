import type { BuildScore, Tier } from "@/types";

// Lógica de scoring de builds (PDF §6 "Cálculo del build score").
// Dueño: Graglia. El wrapper y el mapeo a tier ya están; falta calibrar la
// fórmula de `totalScore` y la detección de cuello de botella.

/** Specs mínimas que necesita el scoring, ya hidratadas desde Mongo. */
export interface SpecsParaScore {
    cpuScore?: number; // 0–100
    gpuScore?: number; // 0–100
    ramSpeed?: number; // MT/s
}

/** Mapeo score (0–100) -> tier. Ejemplo de corte; Graglia ajusta umbrales. */
export function scoreToTier(score: number): Tier {
    if (score >= 90) return "S";
    if (score >= 75) return "A";
    if (score >= 60) return "B";
    if (score >= 40) return "C";
    return "D";
}

/**
 * scoreBuild — combina scoreCPU, scoreGPU y velocidad de RAM en un score
 * 0–100 con bonus de balance, e identifica el cuello de botella.
 * TODO (Graglia): calibrar pesos, normalización de ramSpeed y bonus de balance.
 */
export function scoreBuild(specs: SpecsParaScore): BuildScore {
    const cpu = specs.cpuScore ?? 0;
    const gpu = specs.gpuScore ?? 0;

    // Placeholder: promedio simple. Reemplazar por la fórmula calibrada.
    const totalScore = Math.round((cpu + gpu) / 2);

    // Heurística inicial de cuello de botella (diferencia CPU vs GPU).
    const diff = cpu - gpu;
    const bottleneck =
        diff <= -10 ? "cpu-bound" : diff >= 10 ? "gpu-bound" : "balanced";

    return {
        cpuScore: specs.cpuScore,
        gpuScore: specs.gpuScore,
        ramSpeed: specs.ramSpeed,
        totalScore,
        tier: scoreToTier(totalScore),
        bottleneck,
    };
}
