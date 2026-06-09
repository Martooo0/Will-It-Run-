# 05 · Advertencias activas de una build

**Motores:** Neo4j (Cypher) + MongoDB + Redis
**Patrón (Etapa 1, §6):** *Detección de advertencias activas para una build, evaluando reglas
condicionales sobre los componentes (ej.: RAM DDR5 con motherboard DDR4, fuente próxima a su
límite, cooler insuficiente). Entrada: los componentes con sus specs. Salida: listado de
advertencias con severidad (info/warn/error), título y descripción.*

## Diagrama de flujo en las bases de datos

Integra los **tres** motores. *Cache-aside* (Redis-first); en el miss se combinan grafo + documental.

```text
Cliente --> Redis ---(miss)---> Neo4j  +  MongoDB ---(write-back, TTL 30m)---> Redis
            advertencias:{hash}  APLICA_A   specs numericas
            (cache)              (grafo)    (consumo / TDP / tipo RAM)
```

## Flujo de respuesta

1. **De dónde nace el dato:** las advertencias estructurales viven como nodos `Advertencia` con
   relación `APLICA_A` en el grafo (seed `data/graph.json`); las specs numéricas (consumo, TDP,
   tipo de RAM) están en la colección `components` (Mongo).
2. **Qué proceso lo valida/transforma:** una query Cypher trae las advertencias que `APLICA_A` los
   componentes elegidos; en paralelo, las **reglas numéricas** se evalúan con specs de Mongo:
   - RAM vs motherboard (`type` ≠ `memType`)
   - fuente cerca del límite (`consumo / watts ≥ 0.85`)
   - cooler insuficiente (`tdpCapacity < powerCPU`)
3. **En qué motor se persiste:** Neo4j (advertencias del grafo) + Mongo (specs) + **Redis** cachea
   la lista final en `advertencias:{buildHash}` (TTL 30 min).
4. **Qué consulta se ejecuta:** el `MATCH (:Advertencia)-[:APLICA_A]->(:Componente)` + un `find`
   de specs + el cache en Redis.
5. **Qué resultado se obtiene:** la lista de advertencias activas con su severidad.
6. **Interpretación técnica:** las reglas "de forma" (estándares incompatibles) son del grafo; las
   "de número" (consumo, térmica) salen de combinar specs documentales. Redis evita reevaluar las
   reglas para builds idénticas.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:all
```

El seed incluye la advertencia `gpu-consumo-medio` que `APLICA_A` la `rtx-4070`.

## 2) Consulta para correr y capturar

### Paso A — Neo4j: advertencias del grafo para los componentes

`docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123`

```cypher
WITH ["ryzen-5-7600","hyper-212-black","b650-tomahawk",
      "corsair-vengeance-32-ddr5","samsung-990-pro-1tb",
      "rtx-4070","corsair-rm750e"] AS ids
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente)
WHERE c.id IN ids
RETURN a.id AS id, coalesce(a.severidad,"warn") AS severidad,
       a.title AS title, c.id AS componente
ORDER BY a.severidad DESC, a.id ASC;
```

### Paso B — Mongo: specs que alimentan las reglas numéricas

`docker exec -it wir-mongo mongosh willitrun`

```js
db.components.find(
  { id: { $in: ["ryzen-5-7600","rtx-4070","corsair-vengeance-32-ddr5",
                "samsung-990-pro-1tb","hyper-212-black","corsair-rm750e"] } },
  { _id: 0, id: 1,
    "specs.powerCPU": 1, "specs.powerGPU": 1, "specs.powerRam": 1,
    "specs.powerStg": 1, "specs.powerCooler": 1,
    "specs.watts": 1, "specs.tdpCapacity": 1,
    "specs.memType": 1, "specs.type": 1 }
)
```

Evaluación de las reglas con estas specs:

```
consumo = 65 + 200 + 8 + 6 + 3 = 282 W      fuente = 750 W
uso     = 282 / 750 = 0.38   ( < 0.85 )      -> fuente OK
cooler  = tdpCapacity 150 >= powerCPU 65     -> cooler OK
RAM     = DDR5 == memType DDR5               -> memoria OK
```

### Paso C — Redis: lista final cacheada (cache-aside, TTL 30 min)

`docker exec -it wir-redis redis-cli`

```redis
SET advertencias:ryzen-5-7600:hyper-212-black:b650-tomahawk:corsair-vengeance-32-ddr5:samsung-990-pro-1tb:rtx-4070:corsair-rm750e "[{\"id\":\"gpu-consumo-medio\",\"severidad\":\"warn\"}]" EX 1800
GET advertencias:ryzen-5-7600:hyper-212-black:b650-tomahawk:corsair-vengeance-32-ddr5:samsung-990-pro-1tb:rtx-4070:corsair-rm750e
TTL advertencias:ryzen-5-7600:hyper-212-black:b650-tomahawk:corsair-vengeance-32-ddr5:samsung-990-pro-1tb:rtx-4070:corsair-rm750e
```

## 3) Resultado esperado

```
// Paso A (Neo4j)
id                  severidad  title                  componente
"gpu-consumo-medio" "warn"     "GPU de consumo medio" "rtx-4070"
```

Como las tres reglas numéricas del Paso B **pasan**, la única advertencia activa es la del grafo:

```json
[ { "id": "gpu-consumo-medio", "severidad": "warn", "title": "GPU de consumo medio" } ]
```

## 4) Interpretación

Esta build está bien armada: la fuente usa solo el 38 % de su capacidad, el cooler sobra para el
TDP del CPU y la RAM coincide con el estándar de la motherboard, por eso **no** se disparan las
reglas numéricas. Queda solo la advertencia informativa del grafo sobre el consumo medio de la
GPU. Si se cambiara la fuente por una de 300 W, `uso = 282/300 = 0.94 ≥ 0.85` y aparecería una
advertencia **warn** "Fuente cerca de su límite"; con una RAM DDR4 sobre esta motherboard DDR5,
una **error** de memoria incompatible. La lista resultante se cachea en `advertencias:{buildHash}`.
