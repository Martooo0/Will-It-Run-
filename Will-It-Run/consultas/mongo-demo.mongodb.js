// Demo MongoDB pura - Will It Run
// Ejecutar en la base: willitrun
//
// Opcion 1:
//   docker exec -it wir-mongo mongosh willitrun
//   Luego copiar y pegar bloques.
//
// Opcion 2:
//   docker exec -i wir-mongo mongosh willitrun < consultas/mongo-demo.mongodb.js

// READ: traer todos los componentes.
db.components.find();

// READ: componentes por categoria.
db.components.find({ cat: "cpu" });
db.components.find({ cat: "gpu" });

// READ: componentes por marca.
db.components.find({ brand: "AMD" });

// READ: busqueda por texto.
db.components.find({
  name: { $regex: "ryzen", $options: "i" },
});

// READ: consultas sobre specs.
db.components.find({
  cat: "gpu",
  "specs.scoreGPU": { $gte: 75 },
});

db.components.find({
  cat: "power",
  "specs.watts": { $gte: 700 },
});

db.components.find({
  cat: "memory",
  "specs.type": "DDR5",
  "specs.size": { $gte: 32 },
});

// READ: ordenar y limitar.
db.components
  .find({ cat: "gpu" })
  .sort({ "specs.scoreGPU": -1 })
  .limit(5);

// READ: mostrar solo algunos campos.
db.components.find(
  { cat: "cpu" },
  { _id: 0, id: 1, name: 1, brand: 1, "specs.scoreCPU": 1 },
);

// CREATE: insertar un componente demo.
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
    busType: "PCIe 4.0",
  },
});

// READ: verificar insert.
db.components.findOne({ id: "demo-gpu-clase" });

// UPDATE: actualizar campos simples.
db.components.updateOne(
  { id: "demo-gpu-clase" },
  {
    $set: {
      badge: "Actualizado",
      descripcion: "Componente actualizado desde una query Mongo pura.",
    },
  },
);

// UPDATE: actualizar campos anidados dentro de specs.
db.components.updateOne(
  { id: "demo-gpu-clase" },
  {
    $set: {
      "specs.scoreGPU": 72,
      "specs.vram": 12,
    },
  },
);

// READ: verificar update.
db.components.findOne(
  { id: "demo-gpu-clase" },
  { _id: 0, id: 1, name: 1, badge: 1, descripcion: 1, specs: 1 },
);

// DELETE: borrar solo el componente demo.
db.components.deleteOne({ id: "demo-gpu-clase" });

// READ: verificar delete. Si devuelve null, se borro.
db.components.findOne({ id: "demo-gpu-clase" });

// BUILDS: consultas sobre ensambles.
db.ensambles.find({ esPublica: true });
db.ensambles.find({ perfilUso: "gaming" });
db.ensambles.find({ "componentes.cpu": "ryzen-5-7600" });
db.ensambles.find({ "componentes.gpu": "rtx-4070" });
db.ensambles.find().sort({ buildScore: -1 });

// REVIEWS: consultas sobre reviews.
db.reviews.find({ targetType: "componente" });
db.reviews.find({
  targetType: "build",
  targetId: "665f00000000000000000001",
});
db.reviews.find({ rating: { $gte: 4 } });
db.reviews.find({ tipo: "reporte_problema" });

// AGGREGATE: cantidad de componentes por categoria.
db.components.aggregate([
  {
    $group: {
      _id: "$cat",
      cantidad: { $sum: 1 },
    },
  },
  {
    $sort: { cantidad: -1 },
  },
]);

// AGGREGATE: promedio de score CPU.
db.components.aggregate([
  {
    $match: { cat: "cpu" },
  },
  {
    $group: {
      _id: "$cat",
      promedioScoreCPU: { $avg: "$specs.scoreCPU" },
      cantidad: { $sum: 1 },
    },
  },
]);

// AGGREGATE: ranking simple por rendimiento.
db.components.aggregate([
  {
    $match: {
      cat: { $in: ["cpu", "gpu", "memory"] },
    },
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
            $ifNull: ["$specs.scoreGPU", "$specs.speed"],
          },
        ],
      },
    },
  },
  {
    $sort: { scoreRendimiento: -1 },
  },
]);
