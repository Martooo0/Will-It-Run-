# Patrones de respuesta — Will It Run?

Esta carpeta documenta **cada patrón de consulta** declarado en la Etapa 1 (sección 6)
siguiendo el **patrón de respuesta** que pidió el profesor. La idea es que cada ficha se
pueda **leer, ejecutar y capturar** para el documento final, mostrando solo código de
**MongoDB, Cypher (Neo4j) y Redis** (sin TypeScript).

## El flujo de respuesta (lo que se demuestra en cada ficha)

> 1. **De dónde nace el dato** — qué se carga y en qué motor.
> 2. **Qué proceso lo valida o transforma** — la regla o recorrido que se aplica.
> 3. **En qué motor se persiste** — Mongo (documental), Neo4j (grafo) o Redis (cache/ranking).
> 4. **Qué consulta o script se ejecuta** — la query pura, lista para pegar en la terminal.
> 5. **Qué resultado se obtiene** — la salida esperada.
> 6. **Qué interpretación técnica** — por qué ese resultado valida el diseño NoSQL.

## Los 10 patrones

| #  | Patrón | Motores | Ficha |
|----|--------|---------|-------|
| 01 | Búsqueda y filtrado de componentes | Mongo | `01-busqueda-componentes.md` |
| 02 | Validación de compatibilidad de una build | Neo4j + Redis | `02-validacion-compatibilidad.md` |
| 03 | Componentes compatibles de otra categoría | Neo4j + Mongo | `03-componentes-compatibles.md` |
| 04 | Estimación de rendimiento + cuello de botella | Mongo + Redis | `04-estimacion-rendimiento.md` |
| 05 | Advertencias activas de una build | Neo4j + Mongo + Redis | `05-advertencias-activas.md` |
| 06 | Recomendación de builds por gama y perfil | Mongo | `06-recomendacion-builds.md` |
| 07 | Builds similares (componentes en común) | Neo4j + Mongo | `07-builds-similares.md` |
| 08 | Cálculo de build score y tier | Mongo + Redis | `08-build-score-tier.md` |
| 09 | Ranking de builds populares por período | Redis | `09-ranking-builds-populares.md` |
| 10 | Reseñas y reportes de una build | Mongo | `10-resenas-reportes.md` |

La **integración de los tres motores** (lo que el profe pidió mostrar) se evidencia en los
patrones 2, 4, 5, 8 y 9: el dato nace en Mongo/Neo4j y su resultado se **cachea o rankea en
Redis** (claves `compat:`, `buildscore:`, `advertencias:`, `builds:trending:`). Esa es la
estrategia *cache-aside* / *Redis-first* vista a nivel de datos.

## Cómo preparar el entorno (una sola vez)

```powershell
cd Will-It-Run
docker compose up -d     # levanta wir-mongo (27018), wir-neo4j (7474/7687), wir-redis (6379)
npm run seed:all         # carga Mongo + Neo4j + Redis desde data/*.json
```

> **Una sola forma de cargar el dataset:** `npm run seed:all` (lee `data/*.json`). Los archivos
> `consultas/mongo-insert-demo.mongodb.js`, `mongo-demo.mongodb.js` y los bloques `CREATE` de
> `neo4j-demo.cypher` son **demos de sintaxis** (CRUD), NO la carga real del dataset.

## Cómo abrir cada motor (para pegar las queries)

```powershell
# MongoDB
docker exec -it wir-mongo mongosh willitrun

# Neo4j (Cypher)
docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123

# Redis
docker exec -it wir-redis redis-cli
```

> También se puede usar **MongoDB Compass** (`mongodb://127.0.0.1:27018/willitrun?directConnection=true`)
> y el **Neo4j Browser** (`http://localhost:7474`, usuario `neo4j`, pass `willitrun123`).

## Ver y capturar desde las GUIs (Compass / Neo4j / Redis Insight)

Para sacar screenshots desde las apps de escritorio —cómo conectar cada una a los contenedores y
las **10 consultas adaptadas** a Compass / Neo4j Browser / Redis Insight— ver **[`../GUIS.md`](../GUIS.md)**.

## Capturar las salidas por terminal (alternativa, Imagen Salida)

En vez de copiar a mano, hay un runner que corre las 3 demos y guarda transcripciones limpias
en `consultas/outputs/`:

```powershell
.\consultas\run-demos.ps1          # corre Mongo + Neo4j + Redis y captura los outputs
.\consultas\run-demos.ps1 -Seed    # además recarga el dataset (npm run seed:all) antes
```

Genera `outputs/mongo.txt`, `outputs/neo4j.txt` y `outputs/redis.txt`: de ahí se saca el
screenshot (o se pega el texto) de cada consulta.

## El formato del profe (por consulta)

Cada ficha mapea 1:1 con la plantilla pedida por la cátedra:

| Plantilla del profe   | En la ficha                                                        |
|-----------------------|-------------------------------------------------------------------|
| **Consulta**          | título + *Patrón (Etapa 1, §6)*                                    |
| **Imagen Entrada**    | screenshot del bloque de *2) Consulta para correr y capturar*      |
| **Diagrama de flujo** | sección *Diagrama de flujo en las bases de datos*                  |
| **Código por motor**  | los bloques `mongosh` / `cypher` / `redis` + *Interpretación*      |
| **Imagen Salida**     | screenshot del output del runner (`outputs/*.txt`) o de *3) Resultado esperado* |

## Datos cargados actualmente

El seed de **MongoDB** trae **102 componentes**, **40 builds** (`ensambles`), **25 community
builds** (`communitybuilds`) y **48 reseñas/reportes** (`reviews`). La build de referencia
`665f00000000000000000001` ("AM5 Gaming Equilibrada", gama media, gaming, score 76 / tier A)
sigue presente y es la que usan varias fichas.

**Neo4j** se siembra desde `data/graph.json`, **generado con `node scripts/gen-graph.mjs`** a
partir de `components.json` + `builds.json`: **155 nodos y 1035 relaciones** que cubren los 102
componentes, sus estándares (sockets, memoria, bus), las compatibilidades y las 40 builds. Queda
**consistente con MongoDB**. Si cambia el dataset, regenerar el grafo y volver a correr
`npm run seed:neo4j`.

**Redis** se puebla con `npm run seed:redis` (incluido en `seed:all`): rankings
(`builds:trending`, `componentes:trending`) y cachés de ejemplo (`buildscore`, `compat`,
`advertencias`) derivados del mismo dataset. Se visualizan en Redis Insight (ver `../GUIS.md`).
