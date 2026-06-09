<!--
  Documento técnico final de "Will It Run?" — borrador completo y autocontenido.
  Pegar en el Google Doc / Word del grupo (con la carátula UADE) y exportar a PDF.
  Las marcas _[[ ... ]]_ son acciones del equipo (insertar un screenshot, etc.).
  Todo el código mostrado es MongoDB / Cypher / Redis; el orquestador TS va en el Anexo A.
-->

# Will It Run? — Documento Técnico Final

**Universidad Argentina de la Empresa (UADE)** · **Ingeniería de Datos II** · Año 2026
**Comisión:** Jueves – Turno tarde · **Profesor:** Fernández, Alfonso Martín

**Integrantes:**

| Integrante           | Legajo  | Rol                                   |
|----------------------|---------|---------------------------------------|
| Ferreira, Martín     | 1187544 | Líder técnico / Integración           |
| Peña, Máximo         | 1195388 | Modelador documental (MongoDB)        |
| Alvarez, Facundo     | 1189068 | Modelador de grafos (Neo4j)           |
| Rodriguez, Tiziano   | 1186477 | Modelador clave-valor (Redis)         |
| Graglia, Lorenzo     | 1186207 | Dataset y lógica de scoring           |
| Fan, Juan Ignacio    | 1171557 | Documentación y pruebas               |

---

## 1. Executive Summary

Armar una computadora de escritorio es, para el usuario promedio, una decisión difícil: hay miles
de componentes, estándares que evolucionan (sockets, generaciones de memoria, versiones de PCIe) y
combinaciones que pueden ser **incompatibles** o quedar **desbalanceadas** (cuello de botella).
Las herramientas actuales tipo *PCPartPicker* ordenan el catálogo, pero no responden la pregunta
central: *“¿esta build va a funcionar y cómo va a rendir?”*.

**Will It Run?** es una plataforma que **valida la compatibilidad** de una configuración, **estima
su rendimiento** por gama y perfil de uso, **detecta el cuello de botella** y **recomienda**
componentes y builds a partir de datos de la comunidad. Para resolverlo con eficiencia, la solución
adopta una **arquitectura NoSQL multimodelo**: **MongoDB** (catálogo documental flexible),
**Neo4j** (grafo de compatibilidad y recomendaciones) y **Redis** (caché de baja latencia y
rankings). Cada motor cubre la clase de problema para la que es óptimo, y se integran en una capa de
orquestación con estrategia *cache-aside*.

El impacto esperado es una herramienta de decisión confiable que reduce el riesgo de comprar
componentes incompatibles o mal balanceados, basada en datos objetivos en lugar de prueba y error.

---

## 2. Índice

1. Executive Summary · 2. Índice · 3. Introducción · 4. Misión, Visión, Objetivo Estratégico y Plan
de Acción · 5. Descripción del caso y alcance · 6. Tipos de datos y fuentes · 7. Patrones de consulta
· 8. Modelos NoSQL y justificación · 9. Diseño de las estructuras de datos · 10. Arquitectura · 11.
Implementación y validación (Etapa Final) · 12. Redis: cache-aside real vs snapshot de demostración ·
13. Resultados y análisis · 14. Escalabilidad, distribución y consistencia · 15. Limitaciones · 16.
Mejoras y evolución futura · 17. Conclusiones · Anexo A: Orquestador (Next.js/TypeScript).

---

## 3. Introducción

Hoy el armado de computadoras presenta muchas dificultades para el usuario promedio: la cantidad de
componentes, sus combinaciones y la evolución de estándares generan un desafío real para construir
una PC desde cero. Las plataformas existentes resuelven el ordenamiento del catálogo, pero dejan
afuera algo que para muchos es esencial: **el rendimiento** y la **compatibilidad real** entre piezas.

Will It Run? propone una solución simple a ese problema: validación y estimación de rendimiento sobre
datos de componentes, más recomendaciones basadas en builds de la comunidad. El objetivo no es ser un
catálogo más, sino **guiar la decisión** del usuario con información objetiva.

---

## 4. Misión, Visión, Objetivo Estratégico y Plan de Acción

- **Misión.** Ofrecer una plataforma de confianza, accesible y basada en datos para que los usuarios
  diseñen la configuración de su computadora con información objetiva y rendimiento esperado.
- **Visión.** Convertirnos en la referencia para la planificación de armado de PCs, integrando datos
  de la comunidad y modelos predictivos sobre cualquier ensamble.
- **Objetivo estratégico.** Diseñar e implementar una solución basada en tecnologías NoSQL que
  gestione con eficiencia la flexibilidad de los datos de componentes, las relaciones de
  compatibilidad y las métricas de rendimiento, habilitando consultas analíticas de baja latencia.
- **Plan de acción.** Etapa 0: definición del caso y justificación NoSQL. Etapa 1: diseño conceptual,
  modelos y arquitectura. **Etapa Final: implementación e integración de los tres modelos NoSQL**
  (este documento).

---

## 5. Descripción del caso y alcance

Will It Run? es una plataforma de diseño, validación y predicción de rendimiento de configuraciones
de PC. Permite seleccionar cada componente (CPU, motherboard, RAM, GPU, almacenamiento, fuente,
refrigeración), validar compatibilidad, estimar rendimiento por gama (baja/media/alta) y perfil
(gaming/creative/architecture), y consultar información de la comunidad.

**Alcance incluido (y efectivamente implementado):**

- **Catálogo** de componentes con especificaciones por categoría (MongoDB).
- **Motor de validación de compatibilidad** sobre grafo (Neo4j): socket, memoria, bus.
- **Motor de advertencias** (Neo4j + reglas numéricas con specs de Mongo).
- **Recomendaciones**: componentes compatibles, combinaciones frecuentes y builds similares.
- **Scoring**: build score 0–100, tier S–D y detección de cuello de botella (CPU/GPU-bound).
- **Caché y rankings** (Redis): validaciones, scores, advertencias y *sorted sets* de populares.

**Alcance excluido (coherente con la Etapa 1):** marketplace / precios / stock; integración con
e-commerce; overclocking y ajustes avanzados; simulación eléctrica detallada; estimación de FPS por
juego; el `case` como componente (el form factor quedó como spec de la motherboard).

---

## 6. Tipos de datos y fuentes de información

- **Documentales heterogéneos:** cada categoría de componente tiene atributos propios (una CPU tiene
  socket/núcleos; una GPU, VRAM/TDP; una fuente, watts/eficiencia). Se modelan como documentos.
- **Relacionales en forma de grafo:** las reglas de compatibilidad forman cadenas (CPU → socket →
  motherboards → chipset → estándar de memoria). Se modelan como grafo dirigido con tipos de relación.
- **De comunidad y eventos:** ensambles, reseñas y reportes; crecen de forma continua y requieren
  ranking y filtrado eficientes.
- **Fuentes:** dataset inicial construido por el equipo a partir de especificaciones públicas de
  fabricantes (NVIDIA, AMD, Intel) y aportes de la comunidad.

---

## 7. Patrones de consulta esperados

El diseño se orienta a las consultas. Los 10 patrones (Etapa 1 §6), con su motor:

| #  | Patrón                                           | Motor(es)               |
|----|--------------------------------------------------|-------------------------|
| 01 | Búsqueda y filtrado de componentes               | MongoDB                 |
| 02 | Validación de compatibilidad de una build        | Neo4j + Redis           |
| 03 | Componentes compatibles de otra categoría        | Neo4j + MongoDB         |
| 04 | Estimación de rendimiento + cuello de botella    | MongoDB + Redis         |
| 05 | Advertencias activas de una build                | Neo4j + MongoDB + Redis |
| 06 | Recomendación de builds por gama y perfil        | MongoDB                 |
| 07 | Builds similares (componentes en común)          | Neo4j + MongoDB         |
| 08 | Cálculo de build score y tier                    | MongoDB + Redis         |
| 09 | Ranking de builds populares por período          | Redis                   |
| 10 | Reseñas y reportes de una build                  | MongoDB                 |

---

## 8. Modelos NoSQL seleccionados y justificación

Se integran **tres modelos NoSQL complementarios**: MongoDB (documental), Neo4j (grafos) y Redis
(clave-valor). La elección no busca reemplazar un modelo relacional “porque sí”, sino **asignar cada
necesidad al modelo que mejor se adapta**.

**Limitaciones del modelo relacional para este caso:**
- El catálogo es **altamente heterogéneo**: una tabla por categoría o una tabla con muchas columnas
  nulas complicaría el mantenimiento.
- La compatibilidad son **recorridos** entre componentes y estándares: en SQL exigiría múltiples
  *joins* (CPU, Motherboard, Socket, RAM, Cooling, PSU).
- Cada nuevo estándar (socket, generación de memoria, bus) forzaría **migraciones de esquema**.
- Las recomendaciones y “builds similares” son problemas **de grafo** (vecinos que comparten nodos).
- Los rankings y consultas de alta frecuencia se resuelven mejor con **caché y sorted sets** que con
  agregaciones repetidas.

**Ventajas de la arquitectura NoSQL propuesta:** MongoDB da flexibilidad documental; Neo4j resuelve
la compatibilidad como recorridos del grafo; Redis aporta baja latencia y rankings. Cada subsistema
escala de forma independiente.

---

## 9. Diseño final de las estructuras de datos

### 9.1. MongoDB — 4 colecciones documentales

- **`components`** (catálogo). Atributos comunes (`id`, `name`, `brand`, `cat`) + subdocumento
  `specs` cuya forma **varía por categoría**:

  | Categoría     | Campos de `specs` |
  |---------------|-------------------|
  | `cpu`         | scoreCPU, socket, cores, threads, idle, powerCPU |
  | `gpu`         | scoreGPU, vram, powerGPU, length, busType |
  | `motherboard` | socket, form, memType, memFreqMax, memMax, memSlots, m2, pcieSlots, pciType |
  | `memory`      | type, size, speed, powerRam |
  | `storage`     | capacity, iface, form, read, powerStg |
  | `cooling`     | tdpCapacity, height/radSize, type, sockets[], powerCooler |
  | `power`       | watts, efficiency, modular |

- **`ensambles`** (builds armadas en la plataforma): `nombreBuild`, `perfilUso`, `gama`,
  `componentes` (7 slots: cpu, cooler, motherboard, memory, storage, gpu, psu), `buildScore`, `tier`,
  `powerDraw`, `esPublica`.
- **`communitybuilds`** (builds destacadas de la comunidad): `title`, `autor`, `rating`, `reviews`,
  `note`, `build`, `likes`, `vistas`.
- **`reviews`** (reseñas y reportes): `tipo`, `targetId`, `targetType`, `autor`, `rating`,
  `comentario`. Índice de apoyo `{ targetType: 1, targetId: 1 }`.

### 9.2. Neo4j — grafo de compatibilidad

- **Nodos:** `Componente`, `Socket`, `Chipset`, `EstandarMemoria`, `EstandarBus`, `Build`,
  `Advertencia`.
- **Relaciones:** `TIENE_SOCKET`, `TIENE_CHIPSET`, `TIENE_BUS`, `SOPORTA_MEMORIA`, `COMPATIBLE_CON`,
  `TIENE` (build→componente), `COMBINA_FRECUENTEMENTE_CON`, `APLICA_A`.
- **Constraints e índices** (se aplican en el seed): unicidad de `Componente.id`, `Build.id`,
  `Socket.nombre`, `Chipset.nombre`, `EstandarMemoria.tipo`, `EstandarBus.version`, `Advertencia.id`;
  índices por `Componente.categoria` y `Advertencia.severidad`.
- Las builds se crean en MongoDB y se **replican al grafo** (dual-write) para poder validarlas y
  recomendarlas con Cypher.

### 9.3. Redis — convención de claves y TTL

| Clave                              | Tipo        | Contenido                                   | TTL    |
|------------------------------------|-------------|---------------------------------------------|--------|
| `compat:{cpuId}:{moboId}`          | string      | validación de compatibilidad (JSON)         | 1 h    |
| `buildscore:{buildId}`             | hash        | cpuScore, gpuScore, ramSpeed, totalScore, tier | 24 h |
| `advertencias:{buildHash}`         | string      | ids de advertencias activas (JSON)          | 30 min |
| `builds:trending:{periodo}`        | sorted set  | ranking de builds (score = visitas/likes)   | —      |
| `componentes:trending:{categoria}` | sorted set  | ranking de componentes                      | —      |

---

## 10. Arquitectura definitiva y rol de cada motor

```text
                ┌──────────────────────────┐
                │         Usuario           │
                │       (Página Web)        │
                └────────────┬─────────────┘
                             │
          ┌──────────────────▼──────────────────┐
          │     Aplicación Next.js (Docker)      │
          │   API Routes  ── orquestador ──      │
          │   (cache-aside / Redis-first)        │
          └───┬───────────────┬───────────────┬──┘
              │               │               │
        ┌─────▼────┐    ┌─────▼─────┐   ┌─────▼────┐
        │  Redis   │    │  MongoDB  │   │  Neo4j   │
        │ caché +  │    │ documental│   │  grafo   │
        │ rankings │    │ (fuente)  │   │ (fuente) │
        └──────────┘    └───────────┘   └──────────┘
```

- **MongoDB — fuente documental.** Catálogo, builds, community builds y reviews. Su esquema flexible
  permite atributos propios por categoría sin múltiples tablas.
- **Neo4j — compatibilidad y recomendaciones.** Resuelve en consultas Cypher únicas lo que en SQL
  serían múltiples joins: `validarBuild`, `getAdvertencias`, `recomendarComponentes`,
  `getBuildsSimilares`.
- **Redis — caché y soporte.** Primer motor consultado (cache-aside): cachea resultados costosos con
  TTL y mantiene rankings en sorted sets.

**Flujo típico (cache-aside / Redis-first):** la API valida la entrada (Zod), consulta **Redis**; si
hay *miss*, delega a **Mongo/Neo4j**, devuelve el resultado y lo **guarda en Redis** con TTL. Todo
corre en contenedores Docker (`docker compose`: Mongo 27018, Neo4j 7474/7687, Redis 6379).

---

## 11. Implementación y validación (Etapa Final)

### 11.1. Datasets utilizados

| Motor   | Volumen cargado                                                        |
|---------|-----------------------------------------------------------------------|
| MongoDB | 102 componentes · 40 ensambles · 25 community builds · 48 reseñas      |
| Neo4j   | 155 nodos · 1035 relaciones (cubren los 102 componentes y las 40 builds) |
| Redis   | 5 estructuras (snapshot de demostración; ver §12)                     |

El grafo (`data/graph.json`) se **genera** con `node scripts/gen-graph.mjs` a partir de
`components.json` + `builds.json`, de modo que Mongo y Neo4j quedan **consistentes**.

### 11.2. Ejemplos de carga de datos

Carga canónica del dataset (un solo comando):

```powershell
cd Will-It-Run
docker compose up -d        # levanta Mongo, Neo4j y Redis
npm run seed:all            # carga data/*.json en MongoDB, Neo4j y (snapshot) Redis
```

Inserción en MongoDB (sintaxis pura):

```js
db.components.insertOne({
  id: "demo-cpu-clase", name: "CPU Demo Clase", brand: "DemoBrand", cat: "cpu",
  specs: { scoreCPU: 68, socket: "AM5", cores: 6, threads: 12, idle: 32, powerCPU: 75 }
})
```

Carga en Neo4j (constraint + nodo + relación):

```cypher
CREATE CONSTRAINT componente_id IF NOT EXISTS FOR (c:Componente) REQUIRE c.id IS UNIQUE;
MERGE (cpu:Componente {id:"ryzen-5-7600"}) SET cpu.nombre = "Ryzen 5 7600", cpu.categoria = "cpu";
MERGE (s:Socket {nombre:"AM5"});
MERGE (cpu)-[:TIENE_SOCKET {rol:"requiere", tipoValidacion:"obligatoria"}]->(s);
```

### 11.3. Consultas implementadas y demostración en las GUIs

Las 10 consultas (§7) están implementadas en las API routes y documentadas, una por una, en
`consultas/patrones/0X-*.md` siguiendo la **plantilla del profe**: *Consulta → Imagen Entrada →
Diagrama de flujo → Código por motor → Imagen Salida*. La demostración se hace abriendo cada base en
su GUI (**MongoDB Compass**, **Neo4j Browser/Desktop**, **Redis Insight**); el paso a paso de
conexión y las consultas adaptadas a cada GUI están en `consultas/GUIS.md`.

A continuación, **dos ejemplos completos** (uno con los tres motores, otro con Redis):

#### Ejemplo A — Patrón 05 · Advertencias (integra los 3 motores)

*Diagrama de flujo:*

```text
Cliente --> Redis ---(miss)---> Neo4j  +  MongoDB ---(write-back, TTL 30m)---> Redis
            advertencias:{hash}  APLICA_A   specs numericas
            (cache)              (grafo)    (consumo / TDP / tipo RAM)
```

*Neo4j (advertencias del grafo):*

```cypher
WITH ["ryzen-5-7600","hyper-212-black","b650-tomahawk","corsair-vengeance-32-ddr5",
      "samsung-990-pro-1tb","rtx-4070","corsair-rm750e"] AS ids
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente)
WHERE c.id IN ids
RETURN a.id AS id, a.severidad AS severidad, a.title AS title, c.id AS componente;
```

*MongoDB (specs que alimentan las reglas numéricas):*

```js
db.components.find(
  { id: { $in: ["ryzen-5-7600","rtx-4070","corsair-rm750e"] } },
  { _id: 0, id: 1, "specs.powerCPU": 1, "specs.powerGPU": 1, "specs.watts": 1, "specs.tdpCapacity": 1 }
)
```

*Resultado:* consumo 282 W / fuente 750 W = 38 % (OK), cooler 150 W ≥ CPU 65 W (OK), RAM DDR5 =
motherboard DDR5 (OK); queda solo la advertencia informativa del grafo `gpu-consumo-medio (warn)`.

_[[ Insertar screenshot de Neo4j Browser (tabla/grafo) + Redis Insight (clave `advertencias:...`). ]]_

#### Ejemplo B — Patrón 09 · Ranking de builds populares (Redis)

*Diagrama de flujo:* `Cliente --> Redis (sorted set builds:trending:{periodo})`.

*Comandos (Redis Insight → Workbench):*

```redis
ZREVRANGE builds:trending:semana 0 9 WITHSCORES
ZREVRANGE componentes:trending:cpu 0 9 WITHSCORES
```

*Resultado:* el sorted set devuelve las builds ordenadas por puntaje sin recalcular (`O(log N)`);
la misma operación en Mongo exigiría una agregación costosa en cada lectura.

_[[ Insertar screenshot de Redis Insight mostrando el sorted set ordenado. ]]_

> El resto de las consultas (01, 02, 03, 04, 06, 07, 08, 10) se documenta igual, con su screenshot de
> entrada y de salida, tomando el código de las fichas `consultas/patrones/` y `consultas/GUIS.md`.

---

## 12. Redis: cache-aside real vs snapshot de demostración

Este apartado responde una pregunta clave del diseño: **¿cómo se llena Redis?**

**En el sistema real, Redis arranca vacío y se llena solo (cache-aside / lazy loading).** El
mecanismo está implementado en `src/lib/cache/index.ts`:

```ts
export async function cacheAside<T>(key, ttlSeconds, producer): Promise<T> {
  const redis = getRedis();
  const cached = await redis.get(key);            // 1) ¿está en Redis?
  if (cached !== null) return JSON.parse(cached); //    HIT → se devuelve cacheado
  const fresh = await producer();                 // 2) MISS → consulta a Mongo/Neo4j
  await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds); // 3) se cachea con TTL
  return fresh;
}
```

y lo usan las API routes; por ejemplo, la validación de compatibilidad (`src/app/api/compat`):

```ts
const [validacion, advertencias] = await Promise.all([
  cacheAside(keys.compat(hash), TTL.COMPAT, () => validarBuild(componentes)),
  cacheAside(keys.advertencias(hash), TTL.ADVERTENCIAS, () => getAdvertenciasActivas(componentes)),
]);
```

Los **rankings** tampoco se precargan: se acumulan con `ZINCRBY` cuando ocurre una interacción
(`registrarInteraccionComponente`) y se leen con `ZREVRANGE` (`getComponentesTrending`).

**¿Por qué entonces este TP precarga Redis?** Porque la **demostración** se hace consultando
**directamente en las GUIs** (Cypher en Neo4j, `find()` en Compass), y esas consultas **no pasan por
la aplicación**: por lo tanto el `cacheAside` no se dispara y Redis quedaría vacío. Para poder
**visualizar** las cinco estructuras en Redis Insight sin levantar la web, el script
`scripts/seed-redis.ts` carga un **snapshot representativo** de lo que el cache contendría tras la
operación normal del sistema. Es una decisión consciente y documentada: **la lógica real es
cache-aside; la precarga es solo evidencia visual.**

---

## 13. Resultados obtenidos y análisis

| Motor       | Qué se demostró                                                     | Por qué valida el diseño NoSQL |
|-------------|--------------------------------------------------------------------|--------------------------------|
| **MongoDB** | Filtros por categoría + `specs.*`, conteos y agregaciones.         | El esquema flexible filtra por atributos propios de cada categoría sin una tabla por tipo. |
| **Neo4j**   | Validación AM5 (compatible) vs Intel `core-i5-14600k` sobre AM5 (incompatible); builds similares; advertencias. | Un recorrido del grafo reemplaza múltiples JOINs relacionales. |
| **Redis**   | Rankings (sorted set), caché de validación/score/advertencias con TTL. | Lecturas frecuentes en `O(log N)` y caché que descarga a Mongo/Neo4j. |

El análisis clave no es solo “se obtuvo una salida”, sino que **cada motor resuelve la clase de
problema para la que es óptimo** y, combinados (cache-aside + dual-write), responden patrones que un
único modelo relacional resolvería con más complejidad y peor latencia.

---

## 14. Escalabilidad, distribución y consistencia

- **MongoDB:** sharding horizontal con shard key `{categoria, _id (hash)}`; replica sets de 3 nodos.
- **Neo4j:** cluster causal (líder de escritura + réplicas de lectura); el grafo es chico, así que el
  escalado es por concurrencia de lectura, no por volumen.
- **Redis:** modo Cluster (hash slots) con réplicas y failover automático.
- **Consistencia diferenciada:** fuerte en escrituras de Mongo (catálogo/builds); eventual en
  réplicas de lectura de Neo4j (las reglas cambian poco) y en Redis (los TTL acotan la
  desactualización; el dato autoritativo siempre vive en Mongo/Neo4j).

---

## 15. Limitaciones de la solución

- Entrega sobre **instancias únicas** de cada base (el cluster es propuesta conceptual).
- **Dataset acotado** (102 componentes / 40 builds): suficiente para validar, no exhaustivo.
- Las advertencias **numéricas** se evalúan combinando grafo + specs en la capa de API, no 100 % en
  Cypher.
- El **dual-write** Mongo→Neo4j no usa transacción distribuida (consistencia eventual entre ambos).
- No hay estimación de **FPS real** por juego (fuera de alcance desde la Etapa 1).
- La demostración usa las GUIs en lugar de la app web: por eso Redis se precarga (§12).

---

## 16. Mejoras y evolución futura

- Ampliar el dataset y automatizar su ingesta desde fuentes públicas.
- Llevar **todas** las reglas de advertencia al grafo como *rule-engine* puro (Cypher).
- Registrar visitas/likes como eventos (p. ej. Redis Streams) para alimentar los rankings en vivo.
- Reforzar el dual-write con reintentos / *outbox* para acercar la consistencia Mongo↔Neo4j.
- Frontend completo (catálogo, simulador “Bench”, *Compatibility Graph*) sobre la API ya existente,
  que haría que Redis se llene por cache-aside real durante el uso.

---

## 17. Conclusiones

Will It Run? demuestra que una **arquitectura NoSQL multimodelo** resuelve mejor un dominio que
combina datos heterogéneos, relaciones complejas, consultas de baja latencia y crecimiento continuo.
MongoDB aporta flexibilidad documental, Neo4j resuelve la compatibilidad como recorridos de grafo y
Redis optimiza con caché y rankings; la integración *cache-aside* + *dual-write* en la capa de
orquestación los hace trabajar como un sistema único. La implementación cumple los entregables de la
Etapa Final: estructuras creadas, datos cargados, las consultas ejecutadas y la integración entre
tecnologías evidenciada, con un análisis crítico de sus límites y su evolución.

---

## Anexo A — Orquestador (Next.js / TypeScript)

> No es el foco del TP (se evalúan MongoDB/Neo4j/Redis), pero evidencia la integración real de los
> tres motores.

Las **API Routes** (`src/app/api/**/route.ts`) orquestan los motores con estrategia Redis-first:

1. Validan la entrada con **Zod** y consultan **Redis** (`src/lib/cache/`).
2. En *miss*, delegan a **MongoDB** (`src/lib/mongodb.ts`, modelos Mongoose) y/o **Neo4j**
   (`src/lib/neo4j.ts`, queries en `src/lib/queries/cypher.ts`).
3. Devuelven el resultado y lo **escriben en Redis** (claves en `src/lib/cache/keys.ts`).
4. Al crear/editar una build en Mongo, `src/lib/integration/dualWrite.ts` la **replica en el grafo**:

```ts
// src/app/api/builds/route.ts (POST)
const ensamble = await Ensamble.create(parsed.data);     // 1) fuente de verdad: Mongo
try {
  await replicarBuildEnGrafo({ id: String(ensamble._id), /* ... */ }); // 2) dual-write a Neo4j
} catch (e) {
  console.error("Dual-write a Neo4j falló (build creada en Mongo):", e);
}
```

El cálculo de score/cuello de botella vive en `src/lib/simulation/scoring.ts` y las reglas numéricas
de advertencias en `src/lib/warnings/activeWarnings.ts`. Todo se levanta junto con las bases vía
`docker compose`.
