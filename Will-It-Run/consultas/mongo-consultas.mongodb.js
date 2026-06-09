// Consultas MongoDB (solo lectura) con salida ETIQUETADA para capturar.
// Will It Run? — modelo documental.
//
// Correr y capturar TODO de una (recomendado con --quiet para salida limpia):
//   Get-Content consultas\mongo-consultas.mongodb.js | docker exec -i wir-mongo mongosh willitrun --quiet
//
// O usar el runner que guarda el output a archivo:
//   ./consultas/run-demos.ps1
//
// Nota: la carga del dataset es `npm run seed:all` (este archivo NO carga datos).
// Para demostrar INSERT/UPDATE/DELETE ver consultas/mongo-insert-demo.mongodb.js.

print("\n========== MongoDB · Will It Run? ==========");

print("\n=== 00 · Conteo de documentos por coleccion ===");
printjson({
  components: db.components.countDocuments(),
  ensambles: db.ensambles.countDocuments(),
  communitybuilds: db.communitybuilds.countDocuments(),
  reviews: db.reviews.countDocuments(),
});

// ---------- Patron 01: busqueda y filtrado de componentes ----------
print("\n=== 01a · CPUs por scoreCPU (top 5) ===");
printjson(
  db.components
    .find({ cat: "cpu" }, { _id: 0, id: 1, name: 1, "specs.scoreCPU": 1 })
    .sort({ "specs.scoreCPU": -1 })
    .limit(5)
    .toArray(),
);

print("\n=== 01b · GPUs con scoreGPU >= 75 (top 5) ===");
printjson(
  db.components
    .find(
      { cat: "gpu", "specs.scoreGPU": { $gte: 75 } },
      { _id: 0, id: 1, name: 1, "specs.scoreGPU": 1 },
    )
    .sort({ "specs.scoreGPU": -1 })
    .limit(5)
    .toArray(),
);

print("\n=== 01c · Componentes marca AMD (cantidad + 3 ejemplos) ===");
print("cantidad AMD: " + db.components.countDocuments({ brand: "AMD" }));
printjson(
  db.components
    .find({ brand: "AMD" }, { _id: 0, id: 1, name: 1, cat: 1 })
    .limit(3)
    .toArray(),
);

print("\n=== 01d · Busqueda por texto: 'ryzen' en el nombre ===");
printjson(
  db.components
    .find({ name: { $regex: "ryzen", $options: "i" } }, { _id: 0, id: 1, name: 1 })
    .limit(5)
    .toArray(),
);

print("\n=== 01e · Motherboards DDR5 (socket + memType) ===");
printjson(
  db.components
    .find(
      { cat: "motherboard", "specs.memType": "DDR5" },
      { _id: 0, id: 1, name: 1, "specs.socket": 1, "specs.memType": 1 },
    )
    .limit(5)
    .toArray(),
);

// ---------- Patron 04 / 08: specs que alimentan score y cuello de botella ----------
print("\n=== 04/08 · Specs de la build de referencia (cpu/gpu/ram) ===");
printjson(
  db.components
    .find(
      { id: { $in: ["ryzen-5-7600", "rtx-4070", "corsair-vengeance-32-ddr5"] } },
      { _id: 0, id: 1, "specs.scoreCPU": 1, "specs.scoreGPU": 1, "specs.speed": 1 },
    )
    .toArray(),
);

// ---------- Patron 06: builds preconfiguradas (coleccion ensambles) ----------
print("\n=== 06a · Ensambles publicos por buildScore (top 5) ===");
printjson(
  db.ensambles
    .find(
      { esPublica: true },
      { _id: 1, nombreBuild: 1, perfilUso: 1, gama: 1, buildScore: 1, tier: 1 },
    )
    .sort({ buildScore: -1 })
    .limit(5)
    .toArray(),
);

print("\n=== 06b · Ensambles de perfil gaming ===");
printjson(
  db.ensambles
    .find(
      { perfilUso: "gaming" },
      { _id: 1, nombreBuild: 1, gama: 1, buildScore: 1, tier: 1 },
    )
    .sort({ buildScore: -1 })
    .limit(5)
    .toArray(),
);

// ---------- Patron 10: reseñas y reportes ----------
print("\n=== 10a · Reseñas de la build de referencia (targetType=build) ===");
printjson(
  db.reviews
    .find(
      { targetType: "build", targetId: "665f00000000000000000001" },
      { _id: 0, autor: 1, rating: 1, tipo: 1, comentario: 1 },
    )
    .limit(5)
    .toArray(),
);

print("\n=== 10b · Reportes de problemas (tipo=reporte_problema) ===");
printjson(
  db.reviews
    .find(
      { tipo: "reporte_problema" },
      { _id: 0, targetType: 1, targetId: 1, autor: 1, comentario: 1 },
    )
    .limit(5)
    .toArray(),
);

// ---------- Agregaciones (diseño orientado a consultas) ----------
print("\n=== AGG1 · Cantidad de componentes por categoria ===");
printjson(
  db.components
    .aggregate([
      { $group: { _id: "$cat", cantidad: { $sum: 1 } } },
      { $sort: { cantidad: -1 } },
    ])
    .toArray(),
);

print("\n=== AGG2 · Promedio de scoreCPU y scoreGPU por categoria ===");
printjson(
  db.components
    .aggregate([
      {
        $facet: {
          cpu: [
            { $match: { cat: "cpu" } },
            { $group: { _id: "cpu", promedio: { $avg: "$specs.scoreCPU" }, n: { $sum: 1 } } },
          ],
          gpu: [
            { $match: { cat: "gpu" } },
            { $group: { _id: "gpu", promedio: { $avg: "$specs.scoreGPU" }, n: { $sum: 1 } } },
          ],
        },
      },
    ])
    .toArray(),
);

print("\n=== Fin consultas MongoDB ===\n");
