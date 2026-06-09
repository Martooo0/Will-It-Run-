# 01 · Búsqueda y filtrado de componentes

**Motores:** MongoDB
**Patrón (Etapa 1, §6):** *Búsqueda y filtrado de componentes por categoría, marca y
especificaciones técnicas. Entrada: filtros sobre `cat`, `name`/`brand` y campos de `specs`.
Salida: listado de componentes que cumplen los filtros, ordenados.*

## Diagrama de flujo en las bases de datos

```text
Cliente --> MongoDB
            coleccion "components"
            filtros por cat / brand / specs.*
```

## Flujo de respuesta

1. **De dónde nace el dato:** catálogo de hardware en la colección `components`, cargado por el
   seed desde `data/components.json`.
2. **Qué proceso lo valida/transforma:** se aplican filtros sobre campos comunes (`cat`, `brand`,
   `name`) y sobre el subdocumento `specs` usando notación de punto (`specs.scoreGPU`).
3. **En qué motor se persiste:** MongoDB (modelo documental).
4. **Qué consulta se ejecuta:** `db.components.find(...)` con `sort`/proyección.
5. **Qué resultado se obtiene:** los documentos que cumplen el filtro.
6. **Interpretación técnica:** el esquema flexible (un `specs` distinto por categoría) permite
   filtrar por atributos propios de cada tipo de componente **sin** necesitar una tabla por tipo.

## 1) Carga del dato (de dónde nace)

```powershell
# Carga el dataset base en MongoDB
npm run seed:mongo
```

> Alternativa "Mongo puro" (sin TypeScript) para practicar INSERT:
> `Get-Content consultas\mongo-insert-demo.mongodb.js | docker exec -i wir-mongo mongosh willitrun`
> (OJO: inserta datos de practica `demo-*-clase`, NO es la carga del dataset.)

## 2) Consulta para correr y capturar

Abrir Mongo: `docker exec -it wir-mongo mongosh willitrun`

```js
// Todas las CPUs
db.components.find({ cat: "cpu" })

// GPUs con score >= 75, top 5 ordenadas de mayor a menor
db.components.find(
  { cat: "gpu", "specs.scoreGPU": { $gte: 75 } },
  { _id: 0, id: 1, name: 1, "specs.scoreGPU": 1 }
).sort({ "specs.scoreGPU": -1 }).limit(5)

// Filtrar por marca
db.components.find({ brand: "AMD" })

// Buscar por texto en el nombre (sin importar mayúsculas)
db.components.find({ name: { $regex: "ryzen", $options: "i" } })

// Proyección: mostrar solo algunos campos
db.components.find({ cat: "cpu" }, { _id: 0, id: 1, name: 1, "specs.scoreCPU": 1 })
```

## 3) Resultado esperado

**14 GPUs** cumplen el filtro. Top 5 (con `.limit(5)`):

```js
[
  { id: 'rtx-5090',       name: 'GeForce RTX 5090',       specs: { scoreGPU: 100 } },
  { id: 'rtx-4090',       name: 'GeForce RTX 4090',       specs: { scoreGPU: 100 } },
  { id: 'rtx-5080',       name: 'GeForce RTX 5080',       specs: { scoreGPU: 98 } },
  { id: 'rx-7900-xtx',    name: 'Radeon RX 7900 XTX',     specs: { scoreGPU: 97 } },
  { id: 'rtx-4080-super', name: 'GeForce RTX 4080 SUPER', specs: { scoreGPU: 96 } }
]
```

## 4) Interpretación

La consulta orientada a documentos resuelve en una sola lectura el filtrado por categoría +
atributo técnico (`specs.scoreGPU`). Como cada categoría guarda su propio `specs`, una GPU se
filtra por `scoreGPU` y una fuente por `watts` sin esquemas rígidos: ése es el valor del modelo
documental para un catálogo heterogéneo.
