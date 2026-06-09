# 03 · Componentes compatibles de otra categoría

**Motores:** Neo4j (Cypher) + MongoDB
**Patrón (Etapa 1, §6):** *Dado un componente seleccionado, listar los componentes compatibles de
otra categoría ordenados por algún criterio (rendimiento, popularidad). Entrada: id del componente
+ categoría objetivo. Salida: listado de compatibles con sus specs.*

## Diagrama de flujo en las bases de datos

```text
Cliente --> Neo4j ----------------> MongoDB
            COMPATIBLE_CON           hidrata specs de esos ids
            (devuelve ids de la      y ordena por rendimiento
             categoria objetivo)     o popularidad
```

## Flujo de respuesta

1. **De dónde nace el dato:** la relación `COMPATIBLE_CON` entre componentes vive en el grafo
   Neo4j (seed `data/graph.json`).
2. **Qué proceso lo valida/transforma:** Cypher recorre `COMPATIBLE_CON` desde el componente dado
   hacia la categoría objetivo y devuelve los ids; luego **MongoDB hidrata** esos ids con sus
   `specs` y los ordena.
3. **En qué motor se persiste:** Neo4j (las relaciones) + MongoDB (las specs).
4. **Qué consulta se ejecuta:** el `MATCH ... COMPATIBLE_CON` (Cypher) + un `find` con `$in` (Mongo).
5. **Qué resultado se obtiene:** los componentes compatibles de la categoría pedida, con specs.
6. **Interpretación técnica:** el grafo responde "¿con qué es compatible?" en un salto; el modelo
   documental aporta el detalle técnico. Cada motor hace lo que mejor sabe.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:all     # grafo en Neo4j + catálogo en Mongo
```

## 2) Consulta para correr y capturar

### Paso A — Neo4j: ids compatibles de la categoría objetivo

`docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123`

```cypher
// Memorias compatibles con la motherboard b650-tomahawk
MATCH (c:Componente {id: "b650-tomahawk"})-[:COMPATIBLE_CON]-(otro:Componente)
WHERE otro.categoria = "memory"
RETURN DISTINCT otro.id AS id, otro.nombre AS nombre
ORDER BY id;

// Motherboards compatibles con la CPU ryzen-5-7600
MATCH (c:Componente {id: "ryzen-5-7600"})-[:COMPATIBLE_CON]-(otro:Componente)
WHERE otro.categoria = "motherboard"
RETURN DISTINCT otro.id AS id;
```

### Paso B — Mongo: hidratar specs y ordenar

`docker exec -it wir-mongo mongosh willitrun`

```js
db.components.find(
  { id: { $in: ["corsair-vengeance-32-ddr5"] } },
  { _id: 0, id: 1, name: 1, "specs.type": 1, "specs.speed": 1 }
).sort({ "specs.speed": -1 })
```

## 3) Resultado esperado

```
// Paso A (Neo4j) — 8 memorias DDR5 compatibles con b650-tomahawk (board DDR5)
id
"corsair-vengeance-32-ddr5"
"corsair-vengeance-64-ddr5-6000"
"crucial-pro-32-ddr5-5600"
"gskill-flare-x5-32-ddr5-6000"
"gskill-trident-z5-32-ddr5-6400"
"gskill-trident-z5-64-ddr5-6400"
"kingston-fury-beast-32-ddr5-6000"
"teamgroup-tforce-delta-32-ddr5-6000"
```

```js
// Paso B (Mongo) — hidratar specs de las compatibles y ordenar por velocidad
db.components.find(
  { id: { $in: ["corsair-vengeance-32-ddr5", "gskill-trident-z5-32-ddr5-6400"] } },
  { _id: 0, id: 1, "specs.type": 1, "specs.speed": 1 }
).sort({ "specs.speed": -1 })

[
  { id: 'gskill-trident-z5-32-ddr5-6400', specs: { type: 'DDR5', speed: 6400 } },
  { id: 'corsair-vengeance-32-ddr5',      specs: { type: 'DDR5', speed: 6000 } }
]
```

## 4) Interpretación

La pregunta "dado este componente, ¿qué le puedo poner al lado?" se resuelve en **un salto** del
grafo (`COMPATIBLE_CON`), sin recorrer reglas de socket/memoria a mano. El listado de ids vuelve
"crudo" desde Neo4j y se completa con specs desde Mongo para poder ordenarlo por rendimiento
(`specs.speed`, `specs.scoreGPU`, etc.). Es el patrón de **dos motores colaborando**: grafo para
relaciones, documental para detalle.
