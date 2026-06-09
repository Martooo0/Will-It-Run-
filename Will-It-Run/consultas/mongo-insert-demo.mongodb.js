// Demo de INSERT en MongoDB puro (datos de PRACTICA) - Will It Run
// Ejecutar desde la carpeta Will-It-Run:
//
//   Get-Content consultas\mongo-insert-demo.mongodb.js | docker exec -i wir-mongo mongosh willitrun
//
// =========================================================================
//  ESTO NO ES LA CARGA DEL DATASET.
//  Solo inserta 4 componentes de practica (ids demo-*-clase) para mostrar la
//  sintaxis INSERT de MongoDB en clase, sin pasar por TypeScript.
//
//  La carga REAL del dataset (102 componentes, 40 builds, 25 community, 48
//  reviews + el grafo) se hace SIEMPRE con un solo comando:
//
//      npm run seed:all        (lee data/*.json -> MongoDB y Neo4j)
//
//  Por eso, si corren `npm run seed:mongo` despues de este script, el seed
//  vuelve a dejar la coleccion con el dataset real (sin los demo-*-clase).
//  Eso es lo esperado: el dataset manda, estos inserts son solo demostracion.
// =========================================================================

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
