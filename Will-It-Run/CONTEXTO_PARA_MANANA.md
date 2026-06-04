# Contexto para retomar manana - Will It Run

Este documento resume el estado del proyecto y el flujo recomendado para que el
grupo pueda empezar a trabajar con consultas de bases de datos sin depender de
entender TypeScript.

## 1. Estado actual del proyecto

El repositorio remoto es:

```text
https://github.com/Martooo0/Will-It-Run-.git
```

El trabajo esta en la rama:

```text
feat/capa-nosql-base
```

La estructura del repo quedo asi:

```text
README.md
Will-It-Run/
```

La carpeta importante es:

```text
Will-It-Run/
```

Todo el proyecto real esta ahi: codigo, Docker, seeds, consultas, documentacion,
Next.js, MongoDB, Neo4j y Redis.

## 2. Que bases usa el proyecto

El proyecto usa tres bases:

```text
MongoDB -> documentos
Neo4j   -> grafo / compatibilidad
Redis   -> cache / rankings
```

Para la materia, lo mas importante es practicar consultas puras:

```text
MongoDB -> sintaxis Mongo: db.collection.find(...)
Neo4j   -> Cypher: MATCH (...) RETURN ...
Redis   -> comandos Redis: GET, SET, ZINCRBY, ZREVRANGE...
```

TypeScript no reemplaza esas consultas. TypeScript solo conecta la app con las
bases y expone endpoints para el frontend.

## 3. Requisitos en una PC nueva

Instalar:

1. Git
2. Node.js 20 o superior
3. Docker Desktop
4. MongoDB Compass
5. Neo4j Browser o plugin GraphDB de WebStorm
6. Opcional: RedisInsight

Docker Desktop tiene que estar abierto antes de correr `docker compose`.

## 4. Clonar el repo desde cero

Opcion recomendada, clonando directamente la rama de trabajo:

```bash
git clone -b feat/capa-nosql-base https://github.com/Martooo0/Will-It-Run-.git
cd Will-It-Run-
cd Will-It-Run
```

Al final tienen que estar parados en:

```text
Will-It-Run-\Will-It-Run
```

No trabajar desde la carpeta padre `Will-It-Run-`. La carpeta padre solo envuelve
el repo. El proyecto real esta dentro de `Will-It-Run/`.

## 5. Instalar dependencias

Desde `Will-It-Run/`:

```bash
npm install
```

Esto crea `node_modules/`. No se sube a GitHub.

## 6. Crear archivo de entorno local

Desde `Will-It-Run/`:

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Mac/Linux:

```bash
cp .env.example .env.local
```

Valores importantes:

```text
MONGODB_URI=mongodb://localhost:27018/willitrun
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=willitrun123
REDIS_URL=redis://localhost:6379
```

MongoDB usa el puerto `27018` en la PC para evitar conflictos con otros MongoDB
locales. Dentro de Docker sigue usando `27017`.

## 7. Levantar las bases con Docker

Desde `Will-It-Run/`:

```bash
docker compose up -d
```

Verificar:

```bash
docker compose ps
```

Deberian estar arriba:

```text
wir-mongo
wir-neo4j
wir-redis
```

Puertos:

```text
MongoDB -> 127.0.0.1:27018
Neo4j   -> localhost:7474 web / localhost:7687 bolt
Redis   -> localhost:6379
```

## 8. Cargar datos iniciales

Desde `Will-It-Run/`:

```bash
npm run seed:all
```

Eso ejecuta:

```bash
npm run seed:mongo
npm run seed:neo4j
```

Mongo carga datos desde:

```text
data/components.json
data/builds.json
data/community-builds.json
data/reviews.json
```

Neo4j carga datos desde:

```text
data/graph.json
```

Redis no tiene seed. Se llena cuando la app usa cache o rankings.

## 9. Conectar MongoDB Compass

Crear una conexion nueva con esta URI exacta:

```text
mongodb://127.0.0.1:27018/willitrun?directConnection=true
```

Nombre recomendado:

```text
Will It Run Mongo Docker 27018
```

No usar `27017`, porque en algunas PCs puede existir otro Mongo local y Compass
se conecta al equivocado.

Base esperada:

```text
willitrun
```

Colecciones esperadas:

```text
components
ensambles
communitybuilds
reviews
```

Nota: el archivo de seed se llama `data/builds.json`, pero la coleccion de Mongo
se llama `ensambles` porque el modelo del proyecto todavia se llama `Ensamble`.

## 10. Primeras consultas MongoDB

En Compass, entrar a:

```text
willitrun -> components
```

En `Filter`, probar:

```json
{ "cat": "cpu" }
```

```json
{ "brand": "AMD" }
```

```json
{ "specs.scoreCPU": { "$gte": 70 } }
```

Archivo de guia:

```text
CONSULTAS_MONGO.md
```

Archivo con consultas copiables:

```text
consultas/mongo-demo.mongodb.js
```

Tambien pueden abrir shell:

```bash
docker exec -it wir-mongo mongosh willitrun
```

Y pegar:

```js
db.components.find({ cat: "cpu" })
```

## 11. Conectar Neo4j

Opcion 1: Neo4j Browser:

```text
http://localhost:7474
```

Credenciales:

```text
usuario: neo4j
password: willitrun123
database: neo4j
```

Opcion 2: GraphDB en WebStorm:

```text
Name: Local Dev Neo4j
URL: bolt://localhost:7687
Username: neo4j
Password: willitrun123
Database: neo4j
SSL/TLS: desactivado
```

Primera query:

```cypher
MATCH (n)
RETURN n
LIMIT 50;
```

Ver relaciones como grafo:

```cypher
MATCH p = (a)-[r]->(b)
RETURN p
LIMIT 50;
```

Archivo de guia:

```text
CONSULTAS_NEO4J.md
```

Archivo con consultas copiables:

```text
consultas/neo4j-demo.cypher
```

Tambien pueden abrir shell:

```bash
docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123
```

## 12. Redis

Redis esta corriendo en:

```text
localhost:6379
```

Redis se usa para:

```text
cache de compatibilidad
cache de build score
rankings con sorted sets
```

Para entrar por terminal:

```bash
docker exec -it wir-redis redis-cli
```

Comandos utiles:

```redis
PING
KEYS *
GET alguna_clave
TTL alguna_clave
ZRANGE builds:trending:semana 0 -1 WITHSCORES
```

Todavia no se armo una demo larga de Redis como Mongo/Neo4j, pero la parte de
Redis del codigo esta en:

```text
src/lib/cache/
```

## 13. Que carpetas mirar

Para bases de datos:

```text
data/
consultas/
src/lib/models/
src/lib/queries/
src/lib/cache/
src/app/api/
```

Significado:

```text
data/              -> JSONs de seed
consultas/         -> consultas puras para practicar
src/lib/models/    -> modelos MongoDB
src/lib/queries/   -> queries Cypher usadas por la app
src/lib/cache/     -> Redis
src/app/api/       -> endpoints backend que conectan frontend con bases
```

## 14. Diferencia entre consulta pura y TypeScript

Mongo puro:

```js
db.components.find({ cat: "cpu" })
```

En el backend aparece parecido a:

```ts
Component.find({ cat: "cpu" })
```

La consulta importante sigue siendo:

```js
{ cat: "cpu" }
```

Cypher puro:

```cypher
MATCH (c:Componente)-[:COMPATIBLE_CON]-(otro:Componente)
RETURN otro;
```

En el backend aparece como string dentro de TypeScript, pero la consulta sigue
siendo Cypher.

## 15. Flujo recomendado para trabajar manana

1. Clonar el repo.
2. Entrar a `Will-It-Run/`.
3. Ejecutar `npm install`.
4. Copiar `.env.example` a `.env.local`.
5. Abrir Docker Desktop.
6. Ejecutar `docker compose up -d`.
7. Ejecutar `npm run seed:all`.
8. Abrir MongoDB Compass con `mongodb://127.0.0.1:27018/willitrun?directConnection=true`.
9. Abrir Neo4j Browser o GraphDB con `bolt://localhost:7687`.
10. Abrir `CONSULTAS_MONGO.md` y `CONSULTAS_NEO4J.md`.
11. Probar primero consultas `READ`.
12. Despues probar `CREATE`, `UPDATE`, `DELETE` usando los ids demo.
13. Documentar las consultas que les sirven para la entrega.
14. Recien despues, si una consulta tiene que aparecer en la app, se integra en
    un endpoint de `src/app/api/`.

## 16. Errores comunes

Error:

```text
no configuration file provided: not found
```

Causa: estan parados en la carpeta padre.

Solucion:

```bash
cd Will-It-Run
docker compose up -d
```

Error: Compass muestra bases viejas como `AuditoriaEmpresa`.

Causa: Compass esta conectado a otro Mongo local en `27017`.

Solucion: crear conexion nueva:

```text
mongodb://127.0.0.1:27018/willitrun?directConnection=true
```

Error: GraphDB dice connection failed.

Causa probable: Neo4j no esta levantado.

Solucion:

```bash
docker compose up -d
npm run seed:neo4j
```

Error: no aparecen datos.

Causa probable: falta seed.

Solucion:

```bash
npm run seed:all
```

## 17. Comandos resumen

Desde una PC nueva:

```bash
git clone -b feat/capa-nosql-base https://github.com/Martooo0/Will-It-Run-.git
cd Will-It-Run-
cd Will-It-Run
npm install
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
docker compose up -d
npm run seed:all
```

Validar:

```bash
npm run lint
npm run build
```

Mongo:

```text
mongodb://127.0.0.1:27018/willitrun?directConnection=true
```

Neo4j:

```text
bolt://localhost:7687
neo4j / willitrun123
database: neo4j
```

