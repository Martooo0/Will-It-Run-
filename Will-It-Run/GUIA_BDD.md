# Guia BDD - Will It Run

Esta guia esta pensada para el equipo que se enfoca en bases de datos. No hace
falta dominar Next.js o TypeScript para empezar: lo importante es entender que
cada archivo `route.ts` es un endpoint HTTP y que ahi se llama a MongoDB, Neo4j
o Redis.

## 1. Archivos base

- `docker-compose.yml`: levanta las tres bases locales: MongoDB, Neo4j y Redis.
- `.env.example`: muestra las URLs y passwords que usa la app para conectarse.
- `package.json`: define comandos. Los mas usados son:
  - `npm run dev`: levanta la app.
  - `npm run seed:mongo`: carga JSONs de `data/` en MongoDB.
  - `npm run seed:neo4j`: carga `data/graph.json` en Neo4j.
  - `npm run seed:all`: corre ambos seeds.
- `consultas/mongo-carga.mongodb.js`: carga datos demo con MongoDB puro.
- `consultas/mongo-consultas.mongodb.js`: ejecuta consultas MongoDB puras.

## 2. Conexiones a bases

- `src/lib/mongodb.ts`: exporta `connectMongo()`. Antes de usar un modelo
  Mongoose se llama a esta funcion.
- `src/lib/neo4j.ts`: exporta `getNeo4jDriver()`. Sirve para abrir sesiones y
  correr Cypher.
- `src/lib/redis.ts`: exporta `getRedis()`. Sirve para leer/escribir claves,
  cache y rankings.

## 3. Modelos MongoDB

- `src/lib/models/Component.ts`: coleccion `components`. Guarda catalogo de
  hardware. El campo flexible es `specs`.
- `src/lib/models/Ensamble.ts`: coleccion `ensambles`. Guarda builds armadas.
- `src/lib/models/CommunityBuild.ts`: coleccion `communitybuilds`. Guarda builds
  publicas destacadas.
- `src/lib/models/Review.ts`: coleccion `reviews`. Guarda reviews y reportes.

En Mongoose, un `Schema` es el molde del documento. Un `model` es el objeto que
permite hacer CRUD: `find`, `create`, `findByIdAndUpdate`, `findByIdAndDelete`.

## 4. APIs MongoDB

Componentes:

- `GET /api/components`: lista con filtros `cat`, `brand`, `q`, `sort`, `order`.
- `POST /api/components`: crea un componente.
- `GET /api/components/{id}`: lee un componente por su campo publico `id`.
- `PATCH /api/components/{id}`: actualiza un componente.
- `DELETE /api/components/{id}`: borra un componente.

Builds:

- `GET /api/builds`: lista builds publicas.
- `GET /api/builds?all=true`: lista todas.
- `POST /api/builds`: crea una build en Mongo y la replica a Neo4j.
- `GET /api/builds/{mongoId}`: lee una build.
- `PATCH /api/builds/{mongoId}`: actualiza una build y replica cambios a Neo4j.
- `DELETE /api/builds/{mongoId}`: borra en Mongo e intenta borrar en Neo4j.
- `POST /api/builds/similar`: busca builds del grafo con componentes en comun.

Reviews:

- `GET /api/reviews`: lista reviews. Filtros: `tipo`, `targetType`, `targetId`.
- `POST /api/reviews`: crea review o reporte.
- `GET /api/reviews/{mongoId}`: lee review.
- `PATCH /api/reviews/{mongoId}`: actualiza review.
- `DELETE /api/reviews/{mongoId}`: borra review.

Community:

- `GET /api/community`: lista community builds.
- `GET /api/community?trending=semana`: ranking Redis hidratado con Mongo.
- `POST /api/community`: si recibe `buildId + periodo`, registra interaccion en
  Redis; si recibe `title + build`, crea una community build en Mongo.
- `GET/PATCH/DELETE /api/community/{mongoId}`: CRUD por id Mongo.

## 5. APIs Neo4j y Redis

- `POST /api/compat`: valida una build contra Neo4j y cachea el resultado en
  Redis. Usa `src/lib/queries/cypher.ts`.
- `GET /api/recommendations`: dado un componente, trae compatibles de Neo4j y
  completa los datos desde MongoDB.
- `POST /api/recommendations`: dado un build parcial y `perfilUso`, recomienda
  componentes usando `COMBINA_FRECUENTEMENTE_CON`.
- `POST /api/components/trending`: suma popularidad a un componente en Redis.
- `GET /api/components/trending?cat=cpu`: lee ranking Redis y completa datos
  desde MongoDB.
- `POST /api/performance`: calcula score usando specs Mongo y cache Redis.

## 6. Archivos de datos

- `data/components.json`: componentes base para Mongo.
- `data/builds.json`: builds base para Mongo.
- `data/community-builds.json`: builds comunitarias base.
- `data/reviews.json`: reviews/reportes base.
- `data/graph.json`: nodos y relaciones para Neo4j.

MongoDB y Neo4j no se cargan solos. Despues de levantar Docker hay que correr:

```bash
npm run seed:all
```

Atencion: `seed:mongo` borra y vuelve a insertar las colecciones definidas en
`data/`. No correrlo si tienen datos locales que quieran conservar.

Para trabajar como en clase con MongoDB, tambien pueden cargar datos sin tocar
TypeScript ni JSON ejecutando scripts `.mongodb.js`:

```powershell
Get-Content consultas\mongo-carga.mongodb.js | docker exec -i wir-mongo mongosh willitrun
```

Y para correr consultas:

```powershell
Get-Content consultas\mongo-consultas.mongodb.js | docker exec -i wir-mongo mongosh willitrun
```

Los cambios se ven en MongoDB Compass al refrescar `willitrun -> components`.

## 7. Como leer un `route.ts`

Patron general:

1. `z.object(...)`: define que datos acepta el endpoint.
2. `safeParse(...)`: valida lo que llego por query string o body JSON.
3. `await connectMongo()`: abre conexion si el endpoint usa MongoDB.
4. `Model.find/create/...`: ejecuta CRUD.
5. `NextResponse.json(...)`: responde al cliente.

Ejemplo mental:

```ts
const parsed = schema.safeParse(body);
```

Significa: "chequea que el body tenga la forma esperada". Si falla, se devuelve
HTTP 400. Si pasa, `parsed.data` ya esta validado.
