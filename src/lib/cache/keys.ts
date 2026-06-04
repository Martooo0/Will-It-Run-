// Convención de claves y TTL de Redis (PDF §9.3).
// Centralizar acá los nombres evita typos y mantiene el patrón consistente
// entre todas las API Routes. Dueño: Rodriguez.

// TTL en segundos.
export const TTL = {
    COMPAT: 60 * 60,          // 1 hora  — validaciones de compatibilidad
    BUILDSCORE: 60 * 60 * 24, // 24 horas — scores de ensambles
    ADVERTENCIAS: 60 * 30,    // 30 min   — advertencias activas por build
} as const;

// Builders de claves. Usar siempre estos en lugar de strings sueltos.
export const keys = {
    // string (JSON con result, issues, timestamp)
    compat: (cpuId: string, moboId: string) => `compat:${cpuId}:${moboId}`,
    // hash (cpuScore, gpuScore, ramSpeed, totalScore, tier)
    buildscore: (buildId: string) => `buildscore:${buildId}`,
    // string (JSON con array de ids de advertencias activas)
    advertencias: (buildHash: string) => `advertencias:${buildHash}`,
    // sorted set (score = visitas/likes); periodo = "semana" | "mes"
    buildsTrending: (periodo: string) => `builds:trending:${periodo}`,
    // sorted set (score = inclusiones + likes); categoria = "cpu" | "gpu" | ...
    componentesTrending: (categoria: string) =>
        `componentes:trending:${categoria}`,
} as const;
