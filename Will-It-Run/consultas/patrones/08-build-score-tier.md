# 08 · Cálculo del build score y tier

**Motores:** MongoDB + Redis
**Patrón (Etapa 1, §6):** *Cálculo del build score (0–100) y su tier asociada (S, A, B, C, D), a
partir de los scores normalizados de CPU, GPU y velocidad de RAM, con bonus de balance. Entrada:
los componentes de la build. Salida: el build score (0–100) y la tier (S/A/B/C/D).*

## Diagrama de flujo en las bases de datos

Estrategia *cache-aside* (Redis-first).

```text
Cliente --> Redis ---(miss)---> MongoDB ---(write-back, TTL 24h)---> Redis
            buildscore:{id}     specs scoreCPU / scoreGPU / speed
            (cache, hash)       -> totalScore 0-100 + tier S..D
```

## Flujo de respuesta

1. **De dónde nace el dato:** los `specs.scoreCPU`, `specs.scoreGPU` y `specs.speed` de la
   colección `components` (Mongo).
2. **Qué proceso lo valida/transforma:** se combinan los scores en un total 0–100 y se mapea a un
   tier:
   - `totalScore = round((scoreCPU + scoreGPU) / 2)`
   - tier: `>=90 → S`, `>=75 → A`, `>=60 → B`, `>=40 → C`, `<40 → D`
3. **En qué motor se persiste:** Mongo aporta los scores; **Redis cachea** el resultado en el hash
   `buildscore:{buildId}` (TTL 24 h).
4. **Qué consulta se ejecuta:** el `find` de specs (Mongo) + `HSET/HGETALL` (Redis).
5. **Qué resultado se obtiene:** `totalScore` y `tier`.
6. **Interpretación técnica:** el cálculo es liviano pero su input (specs de 3–4 componentes) se
   repite; cachear el hash reduce la latencia de carga de la build.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:mongo
```

## 2) Consulta para correr y capturar

### Paso A — Mongo: scores de los componentes

`docker exec -it wir-mongo mongosh willitrun`

```js
db.components.find(
  { id: { $in: ["ryzen-5-7600", "rtx-4070", "corsair-vengeance-32-ddr5"] } },
  { _id: 0, id: 1, "specs.scoreCPU": 1, "specs.scoreGPU": 1, "specs.speed": 1 }
)
```

Cálculo:

```
totalScore = round((72 + 80) / 2) = 76
tier(76)   = "A"            // porque 76 >= 75
```

### Paso B — Redis: score y tier cacheados

`docker exec -it wir-redis redis-cli`

```redis
HSET buildscore:665f00000000000000000001 cpuScore 72 gpuScore 80 ramSpeed 6000 totalScore 76 tier A
EXPIRE buildscore:665f00000000000000000001 86400
HGETALL buildscore:665f00000000000000000001
```

## 3) Resultado esperado

```
// Paso B (Redis)
 1) "cpuScore"    2) "72"
 3) "gpuScore"    4) "80"
 5) "ramSpeed"    6) "6000"
 7) "totalScore"  8) "76"
 9) "tier"       10) "A"
```

Coincide con la build sembrada en Mongo (`buildScore: 76`, `tier: "A"` en `data/builds.json`).

## 4) Interpretación

El score combina los scores normalizados de CPU (72) y GPU (80) en un total de **76/100**, que cae
en el tier **A** (rango 75–89). El tier traduce un número a una etiqueta legible para el usuario
(S = tope, D = básica). Persistir el hash `buildscore:{buildId}` en Redis permite mostrar el score
de una build ya vista sin volver a leer las specs desde Mongo.

> Relacionado: el cuello de botella (CPU/GPU-bound) de esta misma build se ve en
> [`04-estimacion-rendimiento.md`](04-estimacion-rendimiento.md).
