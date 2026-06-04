import mongoose from "mongoose";

// Catálogo de hardware (PDF §9.1.1). Atributos comunes + subdocumento `specs`
// cuya forma varía por categoría (esquema flexible: Mixed).
export const CATEGORIAS = [
    "cpu",
    "gpu",
    "motherboard",
    "memory",
    "storage",
    "cooling",
    "power",
] as const;

const componentSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    brand: String,
    cat: { type: String, required: true, enum: CATEGORIAS },
    badge: String,          // etiqueta editorial opcional (ej. "Mejor valor")
    descripcion: String,    // descripción opcional para el detalle de producto
    // Specs heterogéneas por categoría. Forma de referencia por `cat`:
    //   cpu:         { scoreCPU, socket, cores, threads, idle, powerCPU }
    //   gpu:         { scoreGPU, vram, powerGPU, length, busType }
    //   motherboard: { socket, form, memType, memFreqMax, memMax, memSlots, m2, pcieSlots, pciType }
    //                 (el chipset vive en el grafo: nodo Chipset + TIENE_CHIPSET, no en specs)
    //   memory:      { type, size, speed, powerRam }
    //   storage:     { capacity, iface, form, read, powerStg }
    //   cooling:     { tdpCapacity, height|radSize, type, sockets[], powerCooler }
    //   power:       { watts, efficiency, modular }
    specs: { type: mongoose.Schema.Types.Mixed },
});

export const Component =
    mongoose.models.Component || mongoose.model("Component", componentSchema);
