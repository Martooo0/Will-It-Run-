// Genera data/graph.json (grafo de Neo4j) a partir de data/components.json y
// data/builds.json. El grafo se DERIVA de las specs, de modo que Neo4j quede
// consistente con MongoDB (PDF §9.2). Volver a correrlo cada vez que cambie el
// dataset:  node scripts/gen-graph.mjs
import fs from "fs";
import path from "path";

const DATA = path.join(process.cwd(), "data");
const components = JSON.parse(fs.readFileSync(path.join(DATA, "components.json"), "utf-8"));
const builds = JSON.parse(fs.readFileSync(path.join(DATA, "builds.json"), "utf-8"));

const byId = new Map(components.map((c) => [c.id, c]));
const byCat = (cat) => components.filter((c) => c.cat === cat);
const cpus = byCat("cpu");
const mobos = byCat("motherboard");
const mems = byCat("memory");
const gpus = byCat("gpu");
const coolers = byCat("cooling");
const storages = byCat("storage");

const nodes = [];
const relationships = [];
const seenNode = new Set();
const seenCompat = new Set();

function addNode(label, keyField, props) {
    const k = `${label}|${props[keyField]}`;
    if (seenNode.has(k)) return;
    seenNode.add(k);
    nodes.push({ label, props });
}
function addRel(fromLabel, fromVal, type, toLabel, toVal, props = {}) {
    relationships.push({ from: { label: fromLabel, value: fromVal }, type, to: { label: toLabel, value: toVal }, props });
}
// COMPATIBLE_CON es no dirigida: deduplica por par no ordenado.
function addCompatible(aId, bId, motivo) {
    if (!aId || !bId || !byId.has(aId) || !byId.has(bId)) return;
    const key = [aId, bId].sort().join("__");
    if (seenCompat.has(key)) return;
    seenCompat.add(key);
    addRel("Componente", aId, "COMPATIBLE_CON", "Componente", bId, { motivo });
}

// --- Nodos Componente ---
for (const c of components) addNode("Componente", "id", { id: c.id, nombre: c.name, categoria: c.cat });

// --- Nodos de estandares (derivados de specs) ---
const sockets = new Set();
for (const c of cpus) if (c.specs.socket) sockets.add(c.specs.socket);
for (const m of mobos) if (m.specs.socket) sockets.add(m.specs.socket);
for (const k of coolers) for (const s of k.specs.sockets || []) sockets.add(s);
for (const s of sockets) addNode("Socket", "nombre", { nombre: s });

const memTypes = new Set();
for (const m of mobos) if (m.specs.memType) memTypes.add(m.specs.memType);
for (const r of mems) if (r.specs.type) memTypes.add(r.specs.type);
for (const t of memTypes) addNode("EstandarMemoria", "tipo", { tipo: t });

const buses = new Set(["NVMe"]);
for (const g of gpus) if (g.specs.busType) buses.add(g.specs.busType);
for (const m of mobos) if (m.specs.pciType) buses.add("PCIe " + m.specs.pciType);
for (const s of storages) if (s.specs.iface) buses.add(s.specs.iface);
for (const v of buses) addNode("EstandarBus", "version", { version: v });

// --- Relaciones de estandares ---
for (const c of cpus) if (c.specs.socket)
    addRel("Componente", c.id, "TIENE_SOCKET", "Socket", c.specs.socket, { rol: "requiere", tipoValidacion: "obligatoria" });
for (const m of mobos) {
    if (m.specs.socket) addRel("Componente", m.id, "TIENE_SOCKET", "Socket", m.specs.socket, { rol: "ofrece", tipoValidacion: "obligatoria" });
    if (m.specs.memType) addRel("Componente", m.id, "SOPORTA_MEMORIA", "EstandarMemoria", m.specs.memType, { rol: "soporta", velocidadMaxima: m.specs.memFreqMax, capacidadMaximaGB: m.specs.memMax, slots: m.specs.memSlots });
    if (m.specs.pciType) addRel("Componente", m.id, "TIENE_BUS", "EstandarBus", "PCIe " + m.specs.pciType, { rol: "ofrece" });
    if (m.specs.m2 > 0) addRel("Componente", m.id, "TIENE_BUS", "EstandarBus", "NVMe", { rol: "ofrece" });
}
for (const k of coolers) for (const s of k.specs.sockets || [])
    addRel("Componente", k.id, "TIENE_SOCKET", "Socket", s, { rol: "soporta", tipoValidacion: "obligatoria" });
for (const r of mems) if (r.specs.type)
    addRel("Componente", r.id, "SOPORTA_MEMORIA", "EstandarMemoria", r.specs.type, { rol: "usa" });
for (const g of gpus) if (g.specs.busType)
    addRel("Componente", g.id, "TIENE_BUS", "EstandarBus", g.specs.busType, { rol: "requiere" });
for (const s of storages) if (s.specs.iface)
    addRel("Componente", s.id, "TIENE_BUS", "EstandarBus", s.specs.iface, { rol: "requiere" });

// --- COMPATIBLE_CON estructural ---
for (const c of cpus) for (const m of mobos)
    if (c.specs.socket && c.specs.socket === m.specs.socket) addCompatible(c.id, m.id, "socket " + c.specs.socket);
for (const c of cpus) for (const k of coolers)
    if (c.specs.socket && (k.specs.sockets || []).includes(c.specs.socket)) addCompatible(c.id, k.id, "soporte " + c.specs.socket);
for (const m of mobos) for (const r of mems)
    if (m.specs.memType && m.specs.memType === r.specs.type) addCompatible(m.id, r.id, m.specs.memType);

// --- Builds: nodos, TIENE, COMPATIBLE_CON por co-ocurrencia y COMBINA cpu-gpu ---
const combina = new Map();
for (const b of builds) {
    addNode("Build", "id", { id: b._id, gama: b.gama, perfilUso: b.perfilUso });
    const comp = b.componentes || {};
    for (const [slot, id] of Object.entries(comp))
        if (id && byId.has(id)) addRel("Build", b._id, "TIENE", "Componente", id, { slot });

    addCompatible(comp.motherboard, comp.gpu, "usados juntos");
    addCompatible(comp.motherboard, comp.storage, "usados juntos");
    addCompatible(comp.gpu, comp.psu, "margen de potencia");
    addCompatible(comp.cpu, comp.gpu, "usados juntos");

    if (comp.cpu && comp.gpu && byId.has(comp.cpu) && byId.has(comp.gpu)) {
        const key = comp.cpu + "__" + comp.gpu;
        const e = combina.get(key) || { cpu: comp.cpu, gpu: comp.gpu, frecuencia: 0, perfiles: {} };
        e.frecuencia += 1;
        if (b.perfilUso) e.perfiles[b.perfilUso] = (e.perfiles[b.perfilUso] || 0) + 1;
        combina.set(key, e);
    }
}
for (const e of combina.values()) {
    const perfilUso = Object.entries(e.perfiles).sort((a, b) => b[1] - a[1])[0]?.[0];
    addRel("Componente", e.cpu, "COMBINA_FRECUENTEMENTE_CON", "Componente", e.gpu, { frecuencia: e.frecuencia, perfilUso });
}

// --- Advertencias ---
addNode("Advertencia", "id", { id: "gpu-consumo-medio", severidad: "warn", title: "GPU de consumo medio", body: "Revisar margen de fuente si se cambia por una PSU menor." });
addRel("Advertencia", "gpu-consumo-medio", "APLICA_A", "Componente", "rtx-4070", {});
addNode("Advertencia", "id", { id: "gpu-consumo-alto", severidad: "warn", title: "GPU de consumo alto", body: "Verificar que la fuente tenga margen suficiente para esta GPU de alto consumo." });
for (const g of gpus) if ((g.specs.powerGPU || 0) >= 350) addRel("Advertencia", "gpu-consumo-alto", "APLICA_A", "Componente", g.id, {});

fs.writeFileSync(path.join(DATA, "graph.json"), JSON.stringify({ nodes, relationships }, null, 2) + "\n");
const rc = relationships.reduce((acc, r) => ((acc[r.type] = (acc[r.type] || 0) + 1), acc), {});
console.log(`graph.json: ${nodes.length} nodos, ${relationships.length} relaciones`);
console.log("Relaciones por tipo:", rc);
