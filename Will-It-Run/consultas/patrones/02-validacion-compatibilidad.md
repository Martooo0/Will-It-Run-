# 02 · Validación de compatibilidad de una build

**Motores:** Neo4j (Cypher) + Redis
**Patrón (Etapa 1, §6):** *Validación de compatibilidad de una build parcial o completa contra el
conjunto de reglas (socket, watts, estándares de memoria, capacidad térmica). Entrada: los ids de
los componentes. Salida: estado de la build y la lista de issues con su severidad (error/warning).*

## Flujo de respuesta

1. **De dónde nace el dato:** las reglas de compatibilidad viven en el **grafo Neo4j** (nodos
   `Socket`, `EstandarMemoria`, `EstandarBus` y sus relaciones), cargadas del seed
   `data/graph.json` (los 102 componentes con sus estándares).
2. **Qué proceso lo valida/transforma:** una query Cypher recorre `TIENE_SOCKET`,
   `SOPORTA_MEMORIA` y `TIENE_BUS` y verifica que los componentes **compartan** el estándar.
3. **En qué motor se persiste:** Neo4j resuelve la validación; **Redis cachea** el resultado en
   `compat:{cpuId}:{moboId}` (TTL 1 h) para no repetir el recorrido del grafo.
4. **Qué consulta se ejecuta:** los `MATCH`/`OPTIONAL MATCH` de abajo.
5. **Qué resultado se obtiene:** `compatible = true/false` y, si falla, el estándar que no coincide.
6. **Interpretación técnica:** una sola query de grafo reemplaza varios JOINs relacionales entre
   CPU, Motherboard, Socket, RAM, etc.

## 1) Carga del dato (de dónde nace)

```powershell
npm run seed:neo4j     # carga nodos y relaciones desde data/graph.json
```

## 2) Consulta para correr y capturar

Abrir Neo4j: `docker exec -it wir-neo4j cypher-shell -u neo4j -p willitrun123`

### Caso COMPATIBLE (CPU + motherboard comparten socket)

```cypher
MATCH (cpu:Componente {id: "ryzen-5-7600"})
MATCH (mb:Componente {id: "b650-tomahawk"})
OPTIONAL MATCH (cpu)-[:TIENE_SOCKET]->(s:Socket)<-[:TIENE_SOCKET]-(mb)
RETURN cpu.id AS cpu, mb.id AS motherboard,
       s.nombre AS socketComun, s IS NOT NULL AS compatible;
```

### Caso INCOMPATIBLE (CPU Intel LGA1700 contra motherboard AM5)

Mismo patrón, cambiando la CPU por una Intel **real del catálogo** (`core-i5-14600k`, socket
LGA1700). No comparte socket con una motherboard AM5:

```cypher
MATCH (cpu:Componente {id: "core-i5-14600k"})
MATCH (mb:Componente {id: "b650-tomahawk"})
OPTIONAL MATCH (cpu)-[:TIENE_SOCKET]->(s:Socket)<-[:TIENE_SOCKET]-(mb)
RETURN cpu.id AS cpu, mb.id AS motherboard,
       s.nombre AS socketComun, s IS NOT NULL AS compatible;
```

### Validación de memoria (motherboard + RAM comparten DDR)

```cypher
MATCH (mb:Componente {id: "b650-tomahawk"})
MATCH (ram:Componente {id: "corsair-vengeance-32-ddr5"})
OPTIONAL MATCH (mb)-[:SOPORTA_MEMORIA]->(m:EstandarMemoria)<-[:SOPORTA_MEMORIA]-(ram)
RETURN m.tipo AS memoriaComun, m IS NOT NULL AS compatible;
```

## 3) Resultado esperado

```
// Caso compatible
cpu             motherboard      socketComun  compatible
"ryzen-5-7600"  "b650-tomahawk"  "AM5"        true

// Caso incompatible
cpu               motherboard      socketComun  compatible
"core-i5-14600k"  "b650-tomahawk"  NULL         false

// Memoria
memoriaComun  compatible
"DDR5"        true
```

### Resultado cacheado en Redis (cache-aside)

Abrir Redis: `docker exec -it wir-redis redis-cli`

```redis
SET compat:ryzen-5-7600:b650-tomahawk "{\"ok\":true,\"issues\":[]}" EX 3600
GET compat:ryzen-5-7600:b650-tomahawk
TTL compat:ryzen-5-7600:b650-tomahawk
```

```
"{\"ok\":true,\"issues\":[]}"
(integer) 3600
```

## 4) Interpretación

El recorrido del grafo determina la compatibilidad estructural: si CPU y motherboard apuntan al
mismo nodo `Socket`, son compatibles (`AM5`); si no comparten ninguno (Intel `LGA1700` vs `AM5`),
`compatible = false` y eso es un *issue* de severidad **error**. La integración con Redis se ve en
que ese resultado queda cacheado en `compat:...` con TTL de 1 h: la segunda validación de la misma
combinación se sirve desde Redis sin volver a recorrer el grafo.

> Nota: `core-i5-14600k` es un componente **real** del catálogo (no hay que insertar nada); el
> grafo ya contiene los 102 componentes con sus sockets, así que cualquier par CPU/motherboard se
> puede validar directamente.
