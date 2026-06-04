# Consultas Neo4j / Cypher puras - Demo para Ingenieria de Datos II

Este archivo esta escrito para practicar Cypher puro, no TypeScript.

En Neo4j no se consulta con `db.collection.find(...)` como en MongoDB. Se usa
Cypher:

```cypher
MATCH (c:Componente)
RETURN c;
```

TypeScript solo sirve como conexion entre la app y Neo4j. Para la materia,
ustedes pueden escribir, probar y presentar estas consultas Cypher directamente
en Neo4j Browser o `cypher-shell`.

## 1. Como abrir Neo4j

Desde la carpeta del proyecto:

```bash
cd Will-It-Run
docker compose up -d
npm run seed:neo4j
```

Opcion visual recomendada:

```text
http://localhost:7474
```

Credenciales:

```text
usuario: neo4j
password: willitrun123
```

Opcion terminal:

```bash
docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123
```

## 2. Nodos y relaciones del grafo

Nodos principales:

- `Componente`
- `Socket`
- `Chipset`
- `EstandarMemoria`
- `EstandarBus`
- `Build`
- `Advertencia`

Relaciones principales:

- `TIENE_SOCKET`
- `TIENE_CHIPSET`
- `TIENE_BUS`
- `SOPORTA_MEMORIA`
- `COMPATIBLE_CON`
- `TIENE`
- `COMBINA_FRECUENTEMENTE_CON`
- `APLICA_A`

## 3. READ - consultas simples

Ver todos los nodos:

```cypher
MATCH (n)
RETURN n;
```

Contar nodos por tipo:

```cypher
MATCH (n)
RETURN labels(n) AS labels, count(n) AS cantidad
ORDER BY cantidad DESC;
```

Ver todos los componentes:

```cypher
MATCH (c:Componente)
RETURN c.id, c.nombre, c.categoria
ORDER BY c.categoria, c.nombre;
```

Buscar un componente por id:

```cypher
MATCH (c:Componente {id: "ryzen-5-7600"})
RETURN c;
```

Buscar componentes por categoria:

```cypher
MATCH (c:Componente)
WHERE c.categoria = "gpu"
RETURN c.id, c.nombre, c.categoria;
```

## 4. Consultar relaciones

Ver componentes compatibles con una motherboard:

```cypher
MATCH (:Componente {id: "b650-tomahawk"})-[:COMPATIBLE_CON]-(otro:Componente)
RETURN otro.id, otro.nombre, otro.categoria
ORDER BY otro.categoria;
```

Ver el socket de una CPU:

```cypher
MATCH (cpu:Componente {id: "ryzen-5-7600"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN cpu.nombre, socket.nombre;
```

Ver el socket de una motherboard:

```cypher
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN mobo.nombre, socket.nombre;
```

Ver que componentes usan o soportan memoria DDR5:

```cypher
MATCH (c:Componente)-[:SOPORTA_MEMORIA]->(mem:EstandarMemoria {tipo: "DDR5"})
RETURN c.id, c.nombre, c.categoria, mem.tipo;
```

## 5. Validar compatibilidad

CPU y motherboard compatibles por socket:

```cypher
MATCH (cpu:Componente {id: "ryzen-5-7600"})-[:TIENE_SOCKET]->(socketCpu:Socket)
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_SOCKET]->(socketMobo:Socket)
RETURN
  cpu.nombre AS cpu,
  socketCpu.nombre AS socketCpu,
  mobo.nombre AS motherboard,
  socketMobo.nombre AS socketMobo,
  socketCpu.nombre = socketMobo.nombre AS compatible;
```

Motherboard y RAM compatibles por estandar de memoria:

```cypher
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:SOPORTA_MEMORIA]->(memMobo:EstandarMemoria)
MATCH (ram:Componente {id: "corsair-vengeance-32-ddr5"})-[:SOPORTA_MEMORIA]->(memRam:EstandarMemoria)
RETURN
  mobo.nombre AS motherboard,
  memMobo.tipo AS memoriaMotherboard,
  ram.nombre AS ram,
  memRam.tipo AS memoriaRam,
  memMobo.tipo = memRam.tipo AS compatible;
```

Motherboard y GPU compatibles por bus:

```cypher
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_BUS]->(busMobo:EstandarBus)
MATCH (gpu:Componente {id: "rtx-4070"})-[:TIENE_BUS]->(busGpu:EstandarBus)
WHERE busMobo.version = busGpu.version
RETURN
  mobo.nombre AS motherboard,
  gpu.nombre AS gpu,
  busMobo.version AS busCompartido,
  true AS compatible;
```

## 6. Paths

En Neo4j Browser, esta consulta dibuja el camino entre CPU y motherboard:

```cypher
MATCH p = (:Componente {id: "ryzen-5-7600"})-[*1..2]-(:Componente {id: "b650-tomahawk"})
RETURN p
LIMIT 5;
```

Ver todos los componentes conectados directa o indirectamente a una CPU:

```cypher
MATCH (:Componente {id: "ryzen-5-7600"})-[*1..2]-(otro:Componente)
RETURN DISTINCT otro.id, otro.nombre, otro.categoria
ORDER BY otro.categoria;
```

## 7. Builds

Ver componentes de una build:

```cypher
MATCH (b:Build {id: "665f00000000000000000001"})-[r:TIENE]->(c:Componente)
RETURN b.id AS buildId, r.slot AS slot, c.id AS componenteId, c.nombre AS componente
ORDER BY slot;
```

Buscar builds que tengan una GPU especifica:

```cypher
MATCH (b:Build)-[r:TIENE]->(gpu:Componente {id: "rtx-4070"})
RETURN b.id AS buildId, r.slot AS slot, gpu.nombre AS gpu;
```

Buscar builds con componentes en comun con una seleccion:

```cypher
MATCH (b:Build)-[:TIENE]->(c:Componente)
WHERE c.id IN ["ryzen-5-7600", "rtx-4070", "b650-tomahawk"]
RETURN b.id AS buildId, count(DISTINCT c) AS componentesEnComun
ORDER BY componentesEnComun DESC;
```

## 8. Advertencias

Ver advertencias asociadas a una GPU:

```cypher
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente {id: "rtx-4070"})
RETURN a.id, a.severidad, a.title, a.body, c.nombre AS componente;
```

Ver advertencias activas para una build parcial:

```cypher
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente)
WHERE c.id IN ["ryzen-5-7600", "rtx-4070", "b650-tomahawk"]
RETURN a.id, a.severidad, a.title, c.id AS componenteId;
```

## 9. Recomendaciones

Componentes que combinan frecuentemente con una CPU para gaming:

```cypher
MATCH (:Componente {id: "ryzen-5-7600"})-[r:COMBINA_FRECUENTEMENTE_CON]-(rec:Componente)
WHERE r.perfilUso = "gaming"
RETURN
  rec.id,
  rec.nombre,
  rec.categoria,
  r.frecuencia,
  r.ratingPromedio
ORDER BY r.frecuencia DESC, r.ratingPromedio DESC;
```

Recomendar componentes a partir de varios ya elegidos:

```cypher
MATCH (base:Componente)-[r:COMBINA_FRECUENTEMENTE_CON]-(rec:Componente)
WHERE base.id IN ["ryzen-5-7600", "b650-tomahawk"]
  AND NOT rec.id IN ["ryzen-5-7600", "b650-tomahawk"]
  AND r.perfilUso = "gaming"
RETURN
  rec.id,
  rec.nombre,
  rec.categoria,
  sum(r.frecuencia) AS frecuenciaTotal,
  avg(r.ratingPromedio) AS ratingPromedio
ORDER BY frecuenciaTotal DESC, ratingPromedio DESC;
```

## 10. Aggregations

Cantidad de componentes por categoria:

```cypher
MATCH (c:Componente)
RETURN c.categoria AS categoria, count(c) AS cantidad
ORDER BY cantidad DESC;
```

Cantidad de relaciones por tipo:

```cypher
MATCH ()-[r]->()
RETURN type(r) AS relacion, count(r) AS cantidad
ORDER BY cantidad DESC;
```

Cantidad de componentes por build:

```cypher
MATCH (b:Build)-[:TIENE]->(c:Componente)
RETURN b.id AS buildId, count(c) AS cantidadComponentes
ORDER BY cantidadComponentes DESC;
```

## 11. CREATE - crear nodos y relaciones demo

Crear un componente demo:

```cypher
MERGE (demo:Componente {id: "demo-cpu-clase"})
SET
  demo.nombre = "CPU Demo Clase",
  demo.categoria = "cpu";
```

Crear un socket demo y relacionarlo:

```cypher
MATCH (demo:Componente {id: "demo-cpu-clase"})
MERGE (socket:Socket {nombre: "DEMO-SOCKET"})
MERGE (demo)-[:TIENE_SOCKET {
  rol: "requiere",
  tipoValidacion: "obligatoria"
}]->(socket);
```

Verificar:

```cypher
MATCH (demo:Componente {id: "demo-cpu-clase"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN demo, socket;
```

## 12. UPDATE - actualizar nodo demo

```cypher
MATCH (demo:Componente {id: "demo-cpu-clase"})
SET
  demo.nombre = "CPU Demo Clase Actualizada",
  demo.descripcion = "Nodo actualizado desde Cypher puro."
RETURN demo;
```

## 13. DELETE - borrar nodo demo

`DETACH DELETE` borra el nodo y sus relaciones.

```cypher
MATCH (demo:Componente {id: "demo-cpu-clase"})
DETACH DELETE demo;
```

Borrar el socket demo si quedo sin relaciones:

```cypher
MATCH (socket:Socket {nombre: "DEMO-SOCKET"})
WHERE NOT EXISTS {
  MATCH (socket)--()
}
DELETE socket;
```

Verificar que ya no existe:

```cypher
MATCH (demo:Componente {id: "demo-cpu-clase"})
RETURN demo;
```

Si no devuelve filas, se borro correctamente.

## 14. Donde entra TypeScript

Cypher puro:

```cypher
MATCH (:Componente {id: "b650-tomahawk"})-[:COMPATIBLE_CON]-(otro:Componente)
RETURN otro.id, otro.nombre;
```

En la app, ese Cypher se mete como string dentro del backend:

```ts
session.run(`
  MATCH (:Componente {id: $id})-[:COMPATIBLE_CON]-(otro:Componente)
  RETURN otro.id AS id
`, { id: "b650-tomahawk" });
```

La consulta importante sigue siendo Cypher. TypeScript solo pasa parametros,
ejecuta la consulta y devuelve la respuesta al frontend.

