// Demo Neo4j / Cypher pura - Will It Run
//
// Ejecutar primero:
//   docker compose up -d
//   npm run seed:neo4j
//
// Opcion visual:
//   http://localhost:7474
//   usuario: neo4j
//   password: willitrun123
//
// Opcion terminal:
//   docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123
//
// Para correr este archivo entero desde PowerShell:
//   Get-Content consultas\neo4j-demo.cypher | docker exec -i wir-neo4j cypher-shell -u neo4j -p willitrun123

// READ: contar nodos por label.
MATCH (n)
RETURN labels(n) AS labels, count(n) AS cantidad
ORDER BY cantidad DESC;

// READ: listar componentes.
MATCH (c:Componente)
RETURN c.id AS id, c.nombre AS nombre, c.categoria AS categoria
ORDER BY categoria, nombre;

// READ: buscar componente por id.
MATCH (c:Componente {id: "ryzen-5-7600"})
RETURN c;

// READ: buscar componentes por categoria.
MATCH (c:Componente)
WHERE c.categoria = "gpu"
RETURN c.id AS id, c.nombre AS nombre, c.categoria AS categoria;

// RELACIONES: componentes compatibles con una motherboard.
MATCH (:Componente {id: "b650-tomahawk"})-[:COMPATIBLE_CON]-(otro:Componente)
RETURN otro.id AS id, otro.nombre AS nombre, otro.categoria AS categoria
ORDER BY categoria;

// RELACIONES: socket de una CPU.
MATCH (cpu:Componente {id: "ryzen-5-7600"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN cpu.nombre AS cpu, socket.nombre AS socket;

// RELACIONES: socket de una motherboard.
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN mobo.nombre AS motherboard, socket.nombre AS socket;

// VALIDACION: CPU y motherboard compatibles por socket.
MATCH (cpu:Componente {id: "ryzen-5-7600"})-[:TIENE_SOCKET]->(socketCpu:Socket)
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_SOCKET]->(socketMobo:Socket)
RETURN
  cpu.nombre AS cpu,
  socketCpu.nombre AS socketCpu,
  mobo.nombre AS motherboard,
  socketMobo.nombre AS socketMobo,
  socketCpu.nombre = socketMobo.nombre AS compatible;

// VALIDACION: motherboard y RAM compatibles por estandar de memoria.
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:SOPORTA_MEMORIA]->(memMobo:EstandarMemoria)
MATCH (ram:Componente {id: "corsair-vengeance-32-ddr5"})-[:SOPORTA_MEMORIA]->(memRam:EstandarMemoria)
RETURN
  mobo.nombre AS motherboard,
  memMobo.tipo AS memoriaMotherboard,
  ram.nombre AS ram,
  memRam.tipo AS memoriaRam,
  memMobo.tipo = memRam.tipo AS compatible;

// VALIDACION: motherboard y GPU compatibles por bus.
MATCH (mobo:Componente {id: "b650-tomahawk"})-[:TIENE_BUS]->(busMobo:EstandarBus)
MATCH (gpu:Componente {id: "rtx-4070"})-[:TIENE_BUS]->(busGpu:EstandarBus)
WHERE busMobo.version = busGpu.version
RETURN
  mobo.nombre AS motherboard,
  gpu.nombre AS gpu,
  busMobo.version AS busCompartido,
  true AS compatible;

// PATHS: camino entre CPU y motherboard.
MATCH p = (:Componente {id: "ryzen-5-7600"})-[*1..2]-(:Componente {id: "b650-tomahawk"})
RETURN p
LIMIT 5;

// PATHS: componentes conectados a una CPU hasta 2 saltos.
MATCH (:Componente {id: "ryzen-5-7600"})-[*1..2]-(otro:Componente)
RETURN DISTINCT otro.id AS id, otro.nombre AS nombre, otro.categoria AS categoria
ORDER BY categoria;

// BUILDS: componentes de una build.
MATCH (b:Build {id: "665f00000000000000000001"})-[r:TIENE]->(c:Componente)
RETURN b.id AS buildId, r.slot AS slot, c.id AS componenteId, c.nombre AS componente
ORDER BY slot;

// BUILDS: buscar builds que tengan una GPU especifica.
MATCH (b:Build)-[r:TIENE]->(gpu:Componente {id: "rtx-4070"})
RETURN b.id AS buildId, r.slot AS slot, gpu.nombre AS gpu;

// BUILDS: builds con componentes en comun con una seleccion.
MATCH (b:Build)-[:TIENE]->(c:Componente)
WHERE c.id IN ["ryzen-5-7600", "rtx-4070", "b650-tomahawk"]
RETURN b.id AS buildId, count(DISTINCT c) AS componentesEnComun
ORDER BY componentesEnComun DESC;

// ADVERTENCIAS: advertencias asociadas a una GPU.
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente {id: "rtx-4070"})
RETURN a.id AS id, a.severidad AS severidad, a.title AS titulo, a.body AS detalle, c.nombre AS componente;

// ADVERTENCIAS: advertencias activas para una build parcial.
MATCH (a:Advertencia)-[:APLICA_A]->(c:Componente)
WHERE c.id IN ["ryzen-5-7600", "rtx-4070", "b650-tomahawk"]
RETURN a.id AS id, a.severidad AS severidad, a.title AS titulo, c.id AS componenteId;

// RECOMENDACIONES: componentes que combinan frecuentemente con una CPU.
MATCH (:Componente {id: "ryzen-5-7600"})-[r:COMBINA_FRECUENTEMENTE_CON]-(rec:Componente)
WHERE r.perfilUso = "gaming"
RETURN
  rec.id AS id,
  rec.nombre AS nombre,
  rec.categoria AS categoria,
  r.frecuencia AS frecuencia,
  r.ratingPromedio AS ratingPromedio
ORDER BY frecuencia DESC, ratingPromedio DESC;

// RECOMENDACIONES: recomendar a partir de varios componentes elegidos.
MATCH (base:Componente)-[r:COMBINA_FRECUENTEMENTE_CON]-(rec:Componente)
WHERE base.id IN ["ryzen-5-7600", "b650-tomahawk"]
  AND NOT rec.id IN ["ryzen-5-7600", "b650-tomahawk"]
  AND r.perfilUso = "gaming"
RETURN
  rec.id AS id,
  rec.nombre AS nombre,
  rec.categoria AS categoria,
  sum(r.frecuencia) AS frecuenciaTotal,
  avg(r.ratingPromedio) AS ratingPromedio
ORDER BY frecuenciaTotal DESC, ratingPromedio DESC;

// AGGREGATE: cantidad de componentes por categoria.
MATCH (c:Componente)
RETURN c.categoria AS categoria, count(c) AS cantidad
ORDER BY cantidad DESC;

// AGGREGATE: cantidad de relaciones por tipo.
MATCH ()-[r]->()
RETURN type(r) AS relacion, count(r) AS cantidad
ORDER BY cantidad DESC;

// AGGREGATE: cantidad de componentes por build.
MATCH (b:Build)-[:TIENE]->(c:Componente)
RETURN b.id AS buildId, count(c) AS cantidadComponentes
ORDER BY cantidadComponentes DESC;

// CREATE: crear componente demo.
MERGE (demo:Componente {id: "demo-cpu-clase"})
SET
  demo.nombre = "CPU Demo Clase",
  demo.categoria = "cpu";

// CREATE: crear socket demo y relacionarlo.
MATCH (demo:Componente {id: "demo-cpu-clase"})
MERGE (socket:Socket {nombre: "DEMO-SOCKET"})
MERGE (demo)-[:TIENE_SOCKET {
  rol: "requiere",
  tipoValidacion: "obligatoria"
}]->(socket);

// READ: verificar create.
MATCH (demo:Componente {id: "demo-cpu-clase"})-[:TIENE_SOCKET]->(socket:Socket)
RETURN demo.id AS id, demo.nombre AS nombre, socket.nombre AS socket;

// UPDATE: actualizar nodo demo.
MATCH (demo:Componente {id: "demo-cpu-clase"})
SET
  demo.nombre = "CPU Demo Clase Actualizada",
  demo.descripcion = "Nodo actualizado desde Cypher puro."
RETURN demo.id AS id, demo.nombre AS nombre, demo.descripcion AS descripcion;

// DELETE: borrar nodo demo y sus relaciones.
MATCH (demo:Componente {id: "demo-cpu-clase"})
DETACH DELETE demo;

// DELETE: borrar socket demo si quedo sin relaciones.
MATCH (socket:Socket {nombre: "DEMO-SOCKET"})
WHERE NOT EXISTS {
  MATCH (socket)--()
}
DELETE socket;

// READ: verificar delete. Si no devuelve filas, se borro.
MATCH (demo:Componente {id: "demo-cpu-clase"})
RETURN demo;
