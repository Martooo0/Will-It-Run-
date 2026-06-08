// Consultas MongoDB puras - Will It Run
// Ejecutar desde la carpeta Will-It-Run:
//
//   Get-Content consultas\mongo-consultas.mongodb.js | docker exec -i wir-mongo mongosh willitrun
//
// Este archivo es solo para READ y aggregations. No crea, modifica ni borra
// datos. Para cargas usar consultas/mongo-carga.mongodb.js.

// READ: traer todos los componentes.
db.components.find();

// READ: componentes por categoria.
db.components.find({ cat: "cpu" });
db.components.find({ cat: "gpu" });

// READ: componentes por marca.
db.components.find({ brand: "AMD" });
db.components.find({ brand: "DemoBrand" });

// READ: busqueda por texto.
db.components.find({
  name: { $regex: "ryzen", $options: "i" },
});

// READ: buscar un componente por id.
db.components.findOne({ id: "demo-gpu-clase" });

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
  cat: "motherboard",
  "specs.memType": "DDR5",
});

db.components.find({
  cat: "memory",
  "specs.type": "DDR5",
  "specs.size": { $gte: 32 },
});

// READ: ordenar y limitar.
db.components.find({ cat: "gpu" }).sort({ "specs.scoreGPU": -1 }).limit(5);

// READ: mostrar solo algunos campos.
db.components.find(
  { cat: "cpu" },
  { _id: 0, id: 1, name: 1, brand: 1, "specs.scoreCPU": 1 },
);

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

// AGGREGATE: promedio de score GPU.
db.components.aggregate([
  {
    $match: { cat: "gpu" },
  },
  {
    $group: {
      _id: "$cat",
      promedioScoreGPU: { $avg: "$specs.scoreGPU" },
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
