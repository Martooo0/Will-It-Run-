# Consultas MongoDB puras - Demo para Ingenieria de Datos II

Este archivo esta escrito pensando en la materia, no en TypeScript.

La idea es que ustedes escriban consultas con sintaxis MongoDB pura, como en
clase:

```js
db.components.find({ cat: "cpu" })
```

TypeScript solo queda como una capa de conexion para que la app pueda hablar con
MongoDB. Para practicar, presentar o documentar, usen estas consultas Mongo.

## 1. Como trabajar con MongoDB en este proyecto

Hay dos formas validas de cargar datos:

1. **Scripts Mongo puros (`.mongodb.js`)**: es el flujo mas parecido a clase.
   Escriben `db.components.insertOne(...)`, `find(...)`, `updateOne(...)`,
   `aggregate(...)` y lo ejecutan con `mongosh`.
2. **Seed desde JSON (`data/*.json`)**: sirve para restaurar un dataset base
   igual para todo el equipo. El comando `npm run seed:mongo` borra las
   colecciones cargadas por el seed y las vuelve a crear desde los JSON.

Para practicar MongoDB, usen principalmente estos archivos:

- `consultas/mongo-carga.mongodb.js`: comandos `CREATE` para cargar datos demo.
- `consultas/mongo-consultas.mongodb.js`: consultas `READ` y aggregations.
- `consultas/mongo-demo.mongodb.js`: demo completa vieja con CRUD junto.

## 2. Como abrir MongoDB

Desde la carpeta real del proyecto:

```bash
cd Will-It-Run
docker compose up -d
docker exec -it wir-mongo mongosh willitrun
```

Cuando vean el prompt de Mongo, ya pueden pegar consultas como estas:

```js
db.components.find({ cat: "cpu" })
```

Tambien pueden abrir MongoDB Compass con:

```text
mongodb://127.0.0.1:27018/willitrun?directConnection=true
```

## 3. Como ejecutar los scripts `.mongodb.js`

Para cargar datos demo directamente en MongoDB:

```powershell
Get-Content consultas\mongo-carga.mongodb.js | docker exec -i wir-mongo mongosh willitrun
```

Despues de ejecutarlo, abrir o refrescar en Compass:

```text
willitrun -> components
```

Para ejecutar consultas y ver resultados en la terminal:

```powershell
Get-Content consultas\mongo-consultas.mongodb.js | docker exec -i wir-mongo mongosh willitrun
```

Si prefieren Compass:

1. Entrar a `willitrun`.
2. Entrar a la coleccion, por ejemplo `components`.
3. Pegar filtros en el campo `Filter`, por ejemplo:

```json
{ "cat": "cpu" }
```

Para aggregations, usar la pestana `Aggregations` de Compass.

## 4. Donde se ven los resultados

- Si ejecutan un script con `mongosh`, los resultados aparecen en la terminal.
- Si hacen `insertOne`, `insertMany`, `updateOne` o `deleteOne`, los cambios se
  ven en MongoDB Compass al refrescar la coleccion.
- Compass es la mejor herramienta para inspeccionar documentos visualmente.
- La terminal es mas practica para ejecutar archivos completos.

## 5. Colecciones disponibles

El seed carga estas colecciones:

```js
db.components.find()
db.ensambles.find()
db.communitybuilds.find()
db.reviews.find()
```

En MongoDB los nombres reales quedan asi:

- `components`
- `ensambles`
- `communitybuilds`
- `reviews`

Aunque no corran el seed, estas colecciones se crean automaticamente cuando
insertan el primer documento.

## 6. READ - consultas simples

Traer todos los componentes:

```js
db.components.find()
```

Traer solo CPUs:

```js
db.components.find({ cat: "cpu" })
```

Traer solo GPUs:

```js
db.components.find({ cat: "gpu" })
```

Traer componentes AMD:

```js
db.components.find({ brand: "AMD" })
```

Buscar por texto en el nombre, sin importar mayusculas/minusculas:

```js
db.components.find({
  name: { $regex: "ryzen", $options: "i" }
})
```

Buscar un componente por id:

```js
db.components.findOne({ id: "ryzen-5-7600" })
```

## 7. READ - consultas sobre specs

`specs` es un subdocumento. Por eso se consulta con punto:

```js
db.components.find({
  "specs.scoreCPU": { $gte: 70 }
})
```

GPUs con score mayor o igual a 75:

```js
db.components.find({
  cat: "gpu",
  "specs.scoreGPU": { $gte: 75 }
})
```

Fuentes de 700W o mas:

```js
db.components.find({
  cat: "power",
  "specs.watts": { $gte: 700 }
})
```

Motherboards que soportan DDR5:

```js
db.components.find({
  cat: "motherboard",
  "specs.memType": "DDR5"
})
```

Memorias DDR5 de 32GB o mas:

```js
db.components.find({
  cat: "memory",
  "specs.type": "DDR5",
  "specs.size": { $gte: 32 }
})
```

## 8. Ordenar, limitar y proyectar campos

Top 5 GPUs por score:

```js
db.components
  .find({ cat: "gpu" })
  .sort({ "specs.scoreGPU": -1 })
  .limit(5)
```

Top 5 CPUs por score:

```js
db.components
  .find({ cat: "cpu" })
  .sort({ "specs.scoreCPU": -1 })
  .limit(5)
```

Mostrar solo algunos campos:

```js
db.components.find(
  { cat: "cpu" },
  { _id: 0, id: 1, name: 1, brand: 1, "specs.scoreCPU": 1 }
)
```

## 9. CREATE - insertar un componente demo

Esta insercion usa un id de practica: `demo-gpu-clase`.

```js
db.components.insertOne({
  id: "demo-gpu-clase",
  name: "GPU Demo Clase",
  brand: "DemoBrand",
  cat: "gpu",
  badge: "Demo",
  descripcion: "Componente creado para practicar CRUD en MongoDB.",
  specs: {
    scoreGPU: 65,
    vram: 8,
    powerGPU: 180,
    length: 240,
    busType: "PCIe 4.0"
  }
})
```

Verificar que se inserto:

```js
db.components.findOne({ id: "demo-gpu-clase" })
```

## 10. UPDATE - actualizar el componente demo

Actualizar campos simples:

```js
db.components.updateOne(
  { id: "demo-gpu-clase" },
  {
    $set: {
      badge: "Actualizado",
      descripcion: "Componente actualizado desde una query Mongo pura."
    }
  }
)
```

Actualizar campos dentro de `specs`:

```js
db.components.updateOne(
  { id: "demo-gpu-clase" },
  {
    $set: {
      "specs.scoreGPU": 72,
      "specs.vram": 12
    }
  }
)
```

Verificar la actualizacion:

```js
db.components.findOne(
  { id: "demo-gpu-clase" },
  { _id: 0, id: 1, name: 1, badge: 1, descripcion: 1, specs: 1 }
)
```

## 11. DELETE - borrar el componente demo

Borrar solo el documento de practica:

```js
db.components.deleteOne({ id: "demo-gpu-clase" })
```

Verificar que ya no existe:

```js
db.components.findOne({ id: "demo-gpu-clase" })
```

Si devuelve `null`, se borro correctamente.

## 12. Queries sobre ensambles

Traer builds publicas:

```js
db.ensambles.find({ esPublica: true })
```

Traer builds gaming:

```js
db.ensambles.find({ perfilUso: "gaming" })
```

Buscar builds que usen una CPU especifica:

```js
db.ensambles.find({
  "componentes.cpu": "ryzen-5-7600"
})
```

Buscar builds que usen una GPU especifica:

```js
db.ensambles.find({
  "componentes.gpu": "rtx-4070"
})
```

Ordenar builds por score:

```js
db.ensambles
  .find()
  .sort({ buildScore: -1 })
```

## 13. Queries sobre reviews

Reviews de componentes:

```js
db.reviews.find({ targetType: "componente" })
```

Reviews de una build:

```js
db.reviews.find({
  targetType: "build",
  targetId: "665f00000000000000000001"
})
```

Reviews con rating alto:

```js
db.reviews.find({
  rating: { $gte: 4 }
})
```

Reportes de problema:

```js
db.reviews.find({
  tipo: "reporte_problema"
})
```

## 14. Aggregation pipeline

Cantidad de componentes por categoria:

```js
db.components.aggregate([
  {
    $group: {
      _id: "$cat",
      cantidad: { $sum: 1 }
    }
  },
  {
    $sort: { cantidad: -1 }
  }
])
```

Promedio de score de CPU:

```js
db.components.aggregate([
  {
    $match: { cat: "cpu" }
  },
  {
    $group: {
      _id: "$cat",
      promedioScoreCPU: { $avg: "$specs.scoreCPU" },
      cantidad: { $sum: 1 }
    }
  }
])
```

Promedio de score de GPU:

```js
db.components.aggregate([
  {
    $match: { cat: "gpu" }
  },
  {
    $group: {
      _id: "$cat",
      promedioScoreGPU: { $avg: "$specs.scoreGPU" },
      cantidad: { $sum: 1 }
    }
  }
])
```

Ranking simple de componentes por rendimiento:

```js
db.components.aggregate([
  {
    $match: {
      cat: { $in: ["cpu", "gpu", "memory"] }
    }
  },
  {
    $project: {
      _id: 0,
      id: 1,
      name: 1,
      cat: 1,
      scoreRendimiento: {
        $ifNull: [
          "$specs.scoreCPU",
          {
            $ifNull: ["$specs.scoreGPU", "$specs.speed"]
          }
        ]
      }
    }
  },
  {
    $sort: { scoreRendimiento: -1 }
  }
])
```

## 15. Donde entra TypeScript

Ustedes pueden pensar asi:

Mongo puro:

```js
db.components.find({
  cat: "gpu",
  "specs.scoreGPU": { $gte: 75 }
})
```

En la app, alguien pone ese mismo filtro dentro del backend:

```ts
Component.find({
  cat: "gpu",
  "specs.scoreGPU": { $gte: 75 }
})
```

La consulta importante sigue siendo esta parte:

```js
{
  cat: "gpu",
  "specs.scoreGPU": { $gte: 75 }
}
```

Eso es lo que ustedes ya saben de MongoDB. TypeScript solo lo envuelve para que
el frontend pueda pedir datos por HTTP.

