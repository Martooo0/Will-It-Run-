# 07 · Builds similares (componentes en común)

**Motores:** Neo4j (Cypher) + MongoDB
**Patrón (Etapa 1, §6):** *Búsqueda de community builds similares a una build dada o que comparten
componentes clave, junto con su rating y cantidad de reviews. Entrada: la build de referencia +
N (mínimo de componentes en común). Salida: builds similares ordenadas por componentes en común,
con su rating y nº de reviews.*

## Diagrama de flujo en las bases de datos

```text
Cliente --> Neo4j ----------------------> MongoDB
            patron (b)-[:TIENE]->(c)<-     trae rating y cantidad
            [:TIENE]-(otra) = solapamiento de reviews de esas
            de componentes (ids por comun) community builds
```

## Flujo de respuesta

1. **De dónde nace el dato:** los nodos `Build` y su relación `TIENE` hacia los componentes viven
   en el grafo (se crean por *dual-write* cuando se guarda una build en Mongo).
2. **Qué proceso lo valida/transforma:** Cypher cuenta cuántos componentes comparte cada otra
   build con la build de referencia (excluyéndola); luego **Mongo** aporta el detalle de cada
   build similar (nombre, score, tier).
3. **En qué motor se persiste:** Neo4j (relaciones build–componente) + MongoDB (detalle de builds).
4. **Qué consulta se ejecuta:** el `MATCH (Build)-[:TIENE]->(Componente)` con `count` + un `find`
   en `ensambles`.
5. **Qué resultado se obtiene:** las builds ordenadas por componentes en común, con su rating.
6. **Interpretación técnica:** "buscar parecidos" es un problema de grafo (vecinos que comparten
   nodos); el rating agregado es un problema documental.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:all
```

## 2) Consulta para correr y capturar

### Paso A — Neo4j: builds que comparten >= N componentes

`docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123`

```cypher
// Builds similares a la build 001: tomo sus 7 componentes y busco OTRAS builds
// que compartan >= 2, excluyendo la propia.
WITH "665f00000000000000000001" AS refId,
     ["ryzen-5-7600","hyper-212-black","b650-tomahawk","corsair-vengeance-32-ddr5",
      "samsung-990-pro-1tb","rtx-4070","corsair-rm750e"] AS seleccion
MATCH (otra:Build)-[:TIENE]->(c:Componente)
WHERE c.id IN seleccion AND otra.id <> refId
WITH otra, count(DISTINCT c) AS enComun
WHERE enComun >= 2
RETURN otra.id AS buildId, enComun
ORDER BY enComun DESC, buildId;
```

### Paso B — Mongo: detalle de las builds similares (ids del Paso A)

`docker exec -it wir-mongo mongosh willitrun`

```js
db.ensambles.find(
  { _id: { $in: [ ObjectId("665f00000000000000000028"),
                  ObjectId("665f00000000000000000035"),
                  ObjectId("665f00000000000000000007") ] } },
  { _id: 0, nombreBuild: 1, buildScore: 1, tier: 1, perfilUso: 1 }
)
```

## 3) Resultado esperado

```
// Paso A (Neo4j) — builds más similares a la 001
buildId                       enComun
"665f00000000000000000028"    4
"665f00000000000000000035"    3
"665f00000000000000000007"    2
```

```js
// Paso B (Mongo) — hidratadas desde ensambles
[
  { nombreBuild: 'Intel DDR5 Streaming',     buildScore: 83, tier: 'A', perfilUso: 'gaming' },
  { nombreBuild: 'Arquitectura Revit Media', buildScore: 80, tier: 'A', perfilUso: 'architecture' },
  { nombreBuild: 'Creator Compacta AM5',     buildScore: 83, tier: 'A', perfilUso: 'creative' }
]
```

## 4) Interpretación

Tomando los 7 componentes de la build 001, el grafo encuentra sus "vecinas" recorriendo
`(:Build)-[:TIENE]->(:Componente)<-[:TIENE]-(otra:Build)` y las ordena por componentes en común:
**"Arquitectura Revit Media"** comparte 4 (misma RAM, storage, GPU y fuente) y **"Creator Compacta
AM5"** comparte 3. Mongo completa el detalle de cada una (nombre, score, tier). Es el patrón de
**dos motores**: el grafo descubre la similitud sin comparar listas a mano y el documental aporta la
ficha. El rating y las reseñas de cada build se pueden sumar desde `reviews` / `communitybuilds`.
