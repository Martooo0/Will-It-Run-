# Conexión y consultas en las GUIs — Compass / Neo4j / Redis Insight

Guía para **ver los datos y sacar screenshots** desde las tres aplicaciones de escritorio.
Las GUIs son **clientes**: se conectan a los contenedores Docker que ya corren las bases
(Compass y Redis Insight necesitan ese servidor; Neo4j Desktop puede ser servidor, pero acá
usamos el de Docker para no duplicar datos).

Mapa con el formato del profe: la **Imagen Entrada** es el screenshot del input en la GUI
(filtro / Cypher / comando) y la **Imagen Salida** es el screenshot del resultado (tabla de
Compass / grafo de Neo4j / sorted set de Redis Insight).

---

## 0. Preparar las bases (una sola vez)

```powershell
cd Will-It-Run
docker compose up -d     # levanta Mongo (27018), Neo4j (7474/7687), Redis (6379)
npm run seed:all         # carga Mongo + Neo4j + Redis (ahora incluye Redis)
```

> `seed:all` ya deja **las 3 bases pobladas**: Mongo y Neo4j desde `data/*.json`, y Redis con los
> rankings y cachés derivados del dataset (`scripts/seed-redis.ts`).

---

## 1. Conexión de cada GUI al contenedor

### MongoDB Compass
1. **New connection** → pegar la URI:
   ```
   mongodb://localhost:27018/willitrun
   ```
2. **Connect** → base **`willitrun`** → 4 colecciones:
   `components` (102), `ensambles` (40), `communitybuilds` (25), `reviews` (48).

### Neo4j  (la opción más simple es el Browser)
- **Neo4j Browser** (lo sirve el contenedor): abrir **http://localhost:7474**
  - Connect URL `bolt://localhost:7687`, usuario `neo4j`, contraseña `willitrun123`.
- **Neo4j Desktop** (si lo preferís): **New → Remote connection** → `bolt://localhost:7687`,
  `neo4j` / `willitrun123`.
  - ⚠️ **No** crees un *Local DBMS* en Desktop: su puerto 7687 **choca** con el de Docker. Si
    Desktop ya levantó uno, **apagalo** (o apagá el `neo4j` de Docker, pero entonces re-sembrá).

### Redis Insight
1. **Add Redis database** → Host `localhost`, Port `6379` (sin usuario ni password).
2. En **Browser** se ven las claves del seed:
   `builds:trending:*`, `componentes:trending:*`, `buildscore:*`, `compat:*`, `advertencias:*`.
3. Para correr comandos: pestaña **Workbench** (o el botón **CLI**).

> **Sobre Redis (importante para entender la demo).** En la app real, Redis arranca **vacío** y se
> llena solo con *cache-aside*: la API consulta Redis → si hay *miss*, va a Mongo/Neo4j → cachea el
> resultado con TTL (código real en `src/lib/cache/index.ts`, función `cacheAside`). Como en esta
> demostración las consultas se hacen **directo en las GUIs** (no pasan por la app), el cache-aside
> no se dispara: por eso `seed:all` **pre-carga** Redis con un **snapshot de demostración** de lo
> que el cache contendría tras la operación normal del sistema. Es a propósito y así se documenta.

---

## 2. Las 10 consultas, adaptadas a cada GUI

> En **Compass**, el *filtro* va en la barra de filtro de la colección; el orden, la proyección y
> el límite van en **Options** (o pegá el `find()` completo en el shell **mongosh** de abajo).
> En **Neo4j Browser**, pegá el Cypher y Enter (las consultas que devuelven nodos/paths muestran el
> **grafo**). En **Redis Insight**, mirá la clave en *Browser* o corré el comando en *Workbench*.

### 01 · Búsqueda y filtrado de componentes — **Compass** (`components`)
- Filtro: `{ cat: "gpu", "specs.scoreGPU": { $gte: 75 } }`
- Options → Sort `{ "specs.scoreGPU": -1 }` · Limit `5` · Project `{ _id: 0, id: 1, name: 1, "specs.scoreGPU": 1 }`
- Otros filtros para mostrar: `{ cat: "cpu" }` · `{ brand: "AMD" }` ·
  `{ name: { $regex: "ryzen", $options: "i" } }` · `{ cat: "motherboard", "specs.memType": "DDR5" }`

### 02 · Validación de compatibilidad — **Neo4j Browser** + **Redis Insight**
- Neo4j (tabla compatible / incompatible):
  ```cypher
  MATCH (cpu:Componente {id:"ryzen-5-7600"}), (mb:Componente {id:"b650-tomahawk"})
  OPTIONAL MATCH (cpu)-[:TIENE_SOCKET]->(s:Socket)<-[:TIENE_SOCKET]-(mb)
  RETURN cpu.id AS cpu, mb.id AS motherboard, s.nombre AS socketComun, s IS NOT NULL AS compatible;
  ```
- Neo4j (para **ver el grafo** del socket compartido):
  ```cypher
  MATCH p=(:Componente {id:"ryzen-5-7600"})-[:TIENE_SOCKET]->(:Socket)<-[:TIENE_SOCKET]-(:Componente {id:"b650-tomahawk"})
  RETURN p;
  ```
- Caso incompatible (Intel sobre AM5): cambiar la CPU por `core-i5-14600k` → `compatible = false`.
- Redis Insight (resultado cacheado): clave `compat:ryzen-5-7600:b650-tomahawk` (valor + TTL), o en Workbench:
  ```
  GET compat:ryzen-5-7600:b650-tomahawk
  TTL compat:ryzen-5-7600:b650-tomahawk
  ```

### 03 · Componentes compatibles de otra categoría — **Neo4j Browser** + **Compass**
- Neo4j (ids compatibles):
  ```cypher
  MATCH (:Componente {id:"b650-tomahawk"})-[:COMPATIBLE_CON]-(otro:Componente)
  WHERE otro.categoria = "memory"
  RETURN otro.id AS id, otro.nombre AS nombre ORDER BY id;
  ```
- Neo4j (grafo): `MATCH p=(:Componente {id:"b650-tomahawk"})-[:COMPATIBLE_CON]-(:Componente) RETURN p LIMIT 25;`
- Compass (`components`, hidratar specs): filtro
  `{ id: { $in: ["corsair-vengeance-32-ddr5", "gskill-trident-z5-32-ddr5-6400"] } }`

### 04 · Estimación de rendimiento + cuello de botella — **Compass** + **Redis Insight**
- Compass (`components`): filtro `{ id: { $in: ["ryzen-5-7600","rtx-4070","corsair-vengeance-32-ddr5"] } }`
  · Project `{ _id: 0, id: 1, "specs.scoreCPU": 1, "specs.scoreGPU": 1, "specs.speed": 1 }`
- Redis Insight: hash `buildscore:665f00000000000000000001` → `HGETALL` (muestra cpuScore/gpuScore/tier).

### 05 · Advertencias activas — **Neo4j Browser** + **Compass** + **Redis Insight** (los 3)
- Neo4j (advertencias del grafo):
  ```cypher
  MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente {id:"rtx-4070"})
  RETURN a.id, a.severidad, a.title, c.id AS componente;
  ```
- Compass (`components`, specs numéricas): filtro
  `{ id: { $in: ["ryzen-5-7600","rtx-4070","corsair-rm750e"] } }` ·
  Project `{ _id:0, id:1, "specs.powerCPU":1, "specs.powerGPU":1, "specs.watts":1, "specs.tdpCapacity":1 }`
- Redis Insight: clave `advertencias:ryzen-5-7600:hyper-212-black:b650-tomahawk:corsair-vengeance-32-ddr5:samsung-990-pro-1tb:rtx-4070:corsair-rm750e` (valor + TTL).

### 06 · Recomendación de builds por gama y perfil — **Compass** (`ensambles`)
- Filtro: `{ gama: "media", perfilUso: "gaming" }`
- Project: `{ _id: 1, nombreBuild: 1, gama: 1, perfilUso: 1, buildScore: 1, tier: 1, componentes: 1 }`
- También: `{ esPublica: true }` con Sort `{ buildScore: -1 }`.

### 07 · Builds similares (componentes en común) — **Neo4j Browser** + **Compass**
- Neo4j (solapamiento de componentes):
  ```cypher
  WITH "665f00000000000000000001" AS refId,
       ["ryzen-5-7600","hyper-212-black","b650-tomahawk","corsair-vengeance-32-ddr5",
        "samsung-990-pro-1tb","rtx-4070","corsair-rm750e"] AS seleccion
  MATCH (otra:Build)-[:TIENE]->(c:Componente)
  WHERE c.id IN seleccion AND otra.id <> refId
  WITH otra, count(DISTINCT c) AS enComun WHERE enComun >= 2
  RETURN otra.id AS buildId, enComun ORDER BY enComun DESC, buildId;
  ```
- Compass (`ensambles`, detalle — ojo `_id` es **ObjectId**):
  `{ _id: { $in: [ ObjectId("665f00000000000000000028"), ObjectId("665f00000000000000000035") ] } }`

### 08 · Build score y tier — **Compass** + **Redis Insight**
- Compass (`components`): mismas specs que el 04.
- Redis Insight: hash `buildscore:665f00000000000000000001` → `HGETALL` (cpuScore, gpuScore, totalScore, tier).

### 09 · Ranking de builds populares — **Redis Insight** ⭐ (acá brilla Redis)
- En **Browser**: abrir el sorted set **`builds:trending:semana`** → se ven los miembros (ids de
  community builds) **ordenados por score (likes)**. Idem `builds:trending:mes` (vistas) y
  `componentes:trending:cpu` / `:gpu`.
- En **Workbench**:
  ```
  ZREVRANGE builds:trending:semana 0 9 WITHSCORES
  ZREVRANGE componentes:trending:cpu 0 9 WITHSCORES
  ```

### 10 · Reseñas y reportes de una build — **Compass** (`reviews`)
- Filtro (ojo: `targetId` es **string**): `{ targetType: "build", targetId: "665f00000000000000000001" }`
- También: `{ tipo: "reporte_problema" }` · `{ rating: { $gte: 4 } }`

---

## 3. Agregaciones en Compass (pestaña **Aggregations**)

Pegar el pipeline en la pestaña *Aggregations* de la colección `components`:

- **Cantidad de componentes por categoría**
  ```json
  [ { "$group": { "_id": "$cat", "cantidad": { "$sum": 1 } } }, { "$sort": { "cantidad": -1 } } ]
  ```
- **Promedio de scoreCPU**
  ```json
  [ { "$match": { "cat": "cpu" } },
    { "$group": { "_id": "cpu", "promedio": { "$avg": "$specs.scoreCPU" }, "n": { "$sum": 1 } } } ]
  ```

---

## 4. Tips para las capturas

- En **Neo4j Browser**, las consultas con `RETURN p` (paths) o que devuelven nodos muestran la
  **vista de grafo** (botón con el ícono de círculos) — es la mejor captura para "Imagen Salida".
- En **Compass**, sacá una captura del **filtro** (Imagen Entrada) y otra de los **documentos**
  resultantes (Imagen Salida). El contador "N documents" también sirve como evidencia.
- En **Redis Insight**, el sorted set se ve como tabla member/score ya ordenada: ideal para el
  patrón 09. Para las cachés (`compat:`, `buildscore:`, `advertencias:`) mostrá el valor **y el TTL**.
- El detalle de cada consulta (de dónde nace el dato, interpretación) está en
  `consultas/patrones/0X-*.md`.
