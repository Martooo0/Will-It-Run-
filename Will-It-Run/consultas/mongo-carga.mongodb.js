// Carga MongoDB pura - Will It Run
// Ejecutar desde la carpeta Will-It-Run:
//
//   Get-Content consultas\mongo-carga.mongodb.js | docker exec -i wir-mongo mongosh willitrun
//
// Este archivo carga datos directamente en MongoDB, igual que si pegaran estos
// comandos en la shell de MongoDB de Compass o en mongosh.
//
// Importante:
// - Estos datos NO pasan por TypeScript.
// - Se ven en MongoDB Compass despues de refrescar la coleccion.
// - Si despues corren npm run seed:mongo, el seed borra la coleccion y vuelve a
//   cargar lo que esta en data/*.json.

// Para poder ejecutar este archivo varias veces sin chocar por ids duplicados,
// primero limpiamos solo los documentos de practica.
db.components.deleteMany({
  id: {
    $in: [
      "demo-gpu-clase",
      "demo-cpu-clase",
      "demo-mobo-clase",
      "demo-ram-clase",
    ],
  },
});

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

// CREATE: insertar varios componentes demo.
db.components.insertMany([
  {
    id: "demo-cpu-clase",
    name: "CPU Demo Clase",
    brand: "DemoBrand",
    cat: "cpu",
    badge: "Demo",
    descripcion: "CPU creada desde un script .mongodb.js.",
    specs: {
      scoreCPU: 68,
      socket: "AM5",
      cores: 6,
      threads: 12,
      idle: 32,
      powerCPU: 75,
    },
  },
  {
    id: "demo-mobo-clase",
    name: "Motherboard Demo Clase",
    brand: "DemoBrand",
    cat: "motherboard",
    badge: "Demo",
    descripcion: "Motherboard creada desde un script .mongodb.js.",
    specs: {
      socket: "AM5",
      form: "ATX",
      memType: "DDR5",
      memFreqMax: 6200,
      memMax: 128,
      memSlots: 4,
      m2: 2,
      pcieSlots: 3,
      pciType: "4.0",
    },
  },
  {
    id: "demo-ram-clase",
    name: "RAM Demo Clase 32GB DDR5",
    brand: "DemoBrand",
    cat: "memory",
    badge: "Demo",
    descripcion: "Memoria creada desde un script .mongodb.js.",
    specs: {
      type: "DDR5",
      size: 32,
      speed: 5600,
      powerRam: 8,
    },
  },
]);

print("Carga terminada. Refrescar willitrun > components en MongoDB Compass.");
