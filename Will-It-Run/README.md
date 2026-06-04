# Will It Run?

Plataforma de **diseño, validación y recomendación** de configuraciones de PC. No solo valida la
compatibilidad entre componentes: estima el rendimiento esperado de una build por **gama** (baja /
media / alta) y **perfil de uso** (gaming / creative / architecture), y recomienda componentes
coherentes con lo que el usuario ya eligió. Trabajo práctico de **Ingeniería de Datos II**
(UADE, 2026).

> **Alcance (Etapa 1).** El sistema se centra en compatibilidad, scoring y recomendación. **No**
> es un e-commerce: no hay precios, stock ni compras. **No** estima FPS por juego ni corre
> benchmarks por título (inviable de medir para todas las combinaciones); en su lugar usa un
> **score normalizado por componente** y un **build score 0–100** con tier (S–D) y detección de
> cuello de botella (CPU-bound / GPU-bound). El `case` no es un componente del sistema (el form
> factor quedó como spec de la motherboard).

## Stack

- **Next.js 16** (App Router + TypeScript + Tailwind) — frontend y capa de API (`route.ts`).
- **MongoDB** (documental) — catálogo de componentes, ensambles, community builds, reviews.
- **Neo4j** (grafo) — motor de compatibilidad, recomendaciones y advertencias.
- **Redis** (clave-valor) — caché (cache-aside) y rankings (sorted sets).
- **Docker Compose** — levanta las tres bases.

La integración de las tres bases ocurre en la capa de **API Routes**: ante una solicitud se
consulta primero Redis (caché); si no está, se delega a MongoDB y/o Neo4j, se responde y se guarda
en Redis para acelerar consultas futuras.

## Requisitos previos

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — **abierto y corriendo**.
- [Git](https://git-scm.com/)

## Puesta en marcha

### 1. Clonar e instalar

```bash
git clone https://github.com/Martooo0/Will-it-Run-.git
cd Will-it-Run-
npm install
```

### 2. Crear tu archivo de entorno

Las URLs y contraseñas viven en `.env.local`, que **no se sube a Git**. Copiá el template:

- **Windows (PowerShell):** `Copy-Item .env.example .env.local`
- **Mac / Linux:** `cp .env.example .env.local`

Los valores por defecto ya coinciden con `docker-compose.yml`, así que para desarrollo local **no
hace falta cambiar nada**.

### 3. Levantar las bases con Docker

```bash
docker compose up -d
docker compose ps     # verificá que estén arriba
```

| Servicio | Puerto(s) | Para qué |
|---|---|---|
| MongoDB | 27018 (host) -> 27017 (contenedor) | datos documentales |
| Neo4j | 7474 (web) · 7687 (bolt) | grafo de compatibilidad |
| Redis | 6379 | caché y rankings |

### 4. Cargar los datos (seed)

```bash
npm run seed:all      # = seed:mongo + seed:neo4j
```

- `npm run seed:mongo` → siembra las colecciones documentales desde `data/*.json` (cada archivo es
  opcional: si todavía no existe, esa colección se saltea).
- `npm run seed:neo4j` → aplica las **constraints e índices** del grafo y, si existe
  `data/graph.json`, carga nodos y relaciones.
- **Redis no se siembra:** es la capa de caché, se llena sola a medida que la app la usa.

### 5. Arrancar la app y verificar

```bash
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Healthcheck de las tres bases: [http://localhost:3000/api/health](http://localhost:3000/api/health) →
  debe devolver `{"mongo":"ok","neo4j":"ok","redis":"ok"}`.
- Ejemplo documental: `http://localhost:3000/api/components?cat=cpu`.

## Comandos útiles de Docker

| Comando | Qué hace |
|---|---|
| `docker compose up -d` | Levanta las tres bases en segundo plano |
| `docker compose ps` | Estado de los contenedores |
| `docker compose logs -f mongo` | Logs de un servicio (`mongo` / `neo4j` / `redis`) |
| `docker compose down` | Para los contenedores (los datos **se conservan**) |
| `docker compose down -v` | Para los contenedores **y borra todos los datos** |

## Acceso y visualización de las bases (debugging)

Cada motor tiene una GUI oficial gratuita para inspeccionar los datos y probar queries:

- **MongoDB → [Compass](https://www.mongodb.com/products/compass).** Conectá a
  `mongodb://127.0.0.1:27018/willitrun?directConnection=true`, base `willitrun`. Barra de query visual, constructor de pipelines de
  agregación, análisis de esquema e índices. (Alternativa en VS Code: extensión *MongoDB for VS Code*.)
- **Neo4j → Neo4j Browser** (ya incluido): [http://localhost:7474](http://localhost:7474), usuario
  `neo4j`, contraseña `willitrun123`. Pegás Cypher y te **dibuja el grafo**.
- **Redis → [RedisInsight](https://redis.io/insight/).** Conectá a `localhost:6379`. Lista las
  claves por tipo (strings, hashes, sorted sets) y muestra el **TTL** de cada una. Por terminal:
  `docker exec -it wir-redis redis-cli`.

## Modelo de datos (resumen)

- **MongoDB** — colecciones: `Component` (catálogo, `specs` flexibles por categoría), `Ensamble`
  (builds), `CommunityBuild` (builds destacadas con rating), `Review` (reseñas / reportes).
  Categorías válidas: `cpu, gpu, motherboard, memory, storage, cooling, power`.
- **Neo4j** — nodos `Componente`, `Socket`, `Chipset`, `EstandarMemoria`, `EstandarBus`, `Build`,
  `Advertencia`; relaciones `TIENE_SOCKET`, `TIENE_CHIPSET`, `TIENE_BUS`, `SOPORTA_MEMORIA`,
  `COMPATIBLE_CON`, `TIENE`, `COMBINA_FRECUENTEMENTE_CON`, `APLICA_A`. Las builds se crean en Mongo
  y se replican al grafo (**dual-write**).
- **Redis** — claves: `compat:{cpuId}:{moboId}` (1h), `buildscore:{buildId}` (24h),
  `advertencias:{buildHash}` (30min), y sorted sets `builds:trending:{periodo}` /
  `componentes:trending:{categoria}`.

## Estructura del proyecto

La flecha indica contra qué base pega cada endpoint. Entre corchetes, el dueño del módulo.

```
will-it-run/
├── data/
│   ├── components.json          → catálogo (seed de MongoDB)
│   └── graph.json               → nodos + relaciones del grafo (seed de Neo4j)   [Alvarez]
├── scripts/
│   ├── seed-mongo.ts            → siembra las colecciones documentales
│   └── seed-neo4j.ts            → constraints/índices + carga del grafo
├── src/
│   ├── app/
│   │   ├── api/                 → capa de orquestación (cada carpeta = un route.ts)
│   │   │   ├── health/          → healthcheck de las tres bases
│   │   │   ├── components/      → catálogo (filtrado)               → MongoDB
│   │   │   ├── builds/          → ensambles (crear + dual-write)    → MongoDB + Neo4j
│   │   │   ├── compat/          → validación de compatibilidad      → Neo4j (caché Redis)
│   │   │   ├── performance/     → build score / rendimiento         → MongoDB + Redis
│   │   │   ├── recommendations/ → componentes compatibles           → Neo4j + MongoDB
│   │   │   └── community/       → community builds + rankings        → MongoDB + Redis
│   │   └── layout.tsx · page.tsx · globals.css  (frontend: próximamente)
│   ├── types/                   → tipos TypeScript compartidos
│   └── lib/
│       ├── mongodb.ts · neo4j.ts · redis.ts → conexiones singleton
│       ├── models/              → schemas Mongoose                   [Peña]
│       ├── queries/             → queries Cypher                     [Alvarez]
│       ├── cache/               → helpers Redis (claves, TTL, cache-aside, rankings)  [Rodriguez]
│       ├── simulation/          → scoring (build score, tiers, bottleneck)  [Graglia]
│       └── integration/         → dual-write Mongo → Neo4j
├── docker-compose.yml
├── .env.example
└── README.md
```

## Notas para el equipo

- **Nunca subas tu `.env.local`** — está ignorado a propósito. Si agregás una variable nueva,
  sumala también a `.env.example` (sin secretos reales).
- **Las bases arrancan vacías.** Los datos no viajan por Git: cada uno levanta su Docker local y
  corre los seeds (`npm run seed:all`).
- El catálogo se modela con `specs` flexibles por categoría (ver `src/lib/models/Component.ts`). El
  **chipset** de la motherboard vive en el grafo (nodo `Chipset` + `TIENE_CHIPSET`), no en `specs`.

## Equipo y roles

| Integrante | Rol | Funciones principales |
|---|---|---|
| Martin Ferreira | Líder Técnico | Infraestructura Docker, integración entre capas, repositorio |
| Maximo Peña | Modelador Documental | Schemas Mongoose, carga del dataset, queries documentales (MongoDB) |
| Facundo Alvarez | Modelador de Grafos | Grafo y queries Cypher, motor de validación de compatibilidad (Neo4j) |
| Tiziano Rodriguez | Modelador de Redis | Caché, sorted sets para rankings, estrategia de TTL |
| Lorenzo Graglia | Datos y Backend | Dataset de componentes, lógica de scoring, integración entre bases |
| Juan Fan | Documentación y Pruebas | Documento técnico, casos de prueba, registros de validación |

## Flujo de trabajo

Las contribuciones van por **pull request** revisado por el líder técnico antes de mergear a `main`.
