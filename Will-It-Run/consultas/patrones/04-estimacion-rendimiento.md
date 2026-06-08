# 04 · Estimación de rendimiento + cuello de botella

**Motores:** MongoDB + Redis
**Patrón (Etapa 1, §6):** *Estimación del rendimiento esperado de una build identificando el cuello
de botella (CPU-bound vs GPU-bound) y su severidad. Entrada: componentes (cpu, gpu, memory) + gama
+ perfil. Salida: rendimiento estimado y el cuello de botella identificado.*

## Flujo de respuesta

1. **De dónde nace el dato:** los `specs.scoreCPU`, `specs.scoreGPU` y `specs.speed` de los
   componentes en la colección `components` (Mongo).
2. **Qué proceso lo valida/transforma:** se comparan los scores de CPU y GPU para detectar el
   cuello de botella con esta regla (`diff = scoreCPU - scoreGPU`):
   - `diff <= -10` → **cpu-bound** (la CPU limita a la GPU)
   - `diff >= 10` → **gpu-bound** (la GPU limita a la CPU)
   - en otro caso → **balanced** (sin cuello de botella marcado)
3. **En qué motor se persiste:** Mongo aporta los scores; **Redis cachea** el resultado en
   `buildscore:{buildId}` (TTL 24 h).
4. **Qué consulta se ejecuta:** el `find` de specs (Mongo) + `HSET/HGETALL` (Redis).
5. **Qué resultado se obtiene:** scores leídos + cuello de botella calculado.
6. **Interpretación técnica:** estimar rendimiento es leer 2–3 specs y aplicar una regla; cachear
   evita releer Mongo en cada visita a la misma build.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:mongo
```

## 2) Consulta para correr y capturar

### Paso A — Mongo: leer los scores de la build

`docker exec -it wir-mongo mongosh willitrun`

```js
db.components.find(
  { id: { $in: ["ryzen-5-7600", "rtx-4070", "corsair-vengeance-32-ddr5"] } },
  { _id: 0, id: 1, "specs.scoreCPU": 1, "specs.scoreGPU": 1, "specs.speed": 1 }
)
```

Cálculo (regla de la sección 2, con scoreCPU=72 y scoreGPU=80):

```
diff = 72 - 80 = -8     ->  -10 < -8 < 10   ->  bottleneck = "balanced"
```

### Paso B — Redis: resultado cacheado (cache-aside)

`docker exec -it wir-redis redis-cli`

```redis
HSET buildscore:665f00000000000000000001 cpuScore 72 gpuScore 80 ramSpeed 6000 bottleneck balanced
EXPIRE buildscore:665f00000000000000000001 86400
HGETALL buildscore:665f00000000000000000001
TTL buildscore:665f00000000000000000001
```

## 3) Resultado esperado

```js
// Paso A (Mongo)
[
  { id: 'ryzen-5-7600', specs: { scoreCPU: 72 } },
  { id: 'rtx-4070', specs: { scoreGPU: 80 } },
  { id: 'corsair-vengeance-32-ddr5', specs: { speed: 6000 } }
]
```

```
// Paso B (Redis)
1) "cpuScore"   2) "72"
3) "gpuScore"   4) "80"
5) "ramSpeed"   6) "6000"
7) "bottleneck" 8) "balanced"
(integer) 86400
```

## 4) Interpretación

Con `scoreCPU 72` y `scoreGPU 80`, la diferencia (−8) está dentro del margen de ±10, así que la
build queda **balanceada**: ni la CPU ni la GPU se frenan entre sí, coherente con una build de
**gama media** para gaming. Si en cambio se montara una GPU de gama alta con esta misma CPU, la
diferencia superaría +10 y la estimación marcaría **gpu-bound** (la GPU "sobra" para esa CPU). El
resultado se guarda en `buildscore:{buildId}` para servir la estimación sin recalcular.

> Relacionado: el número de score (0–100) y su tier se ven en
> [`08-build-score-tier.md`](08-build-score-tier.md).
