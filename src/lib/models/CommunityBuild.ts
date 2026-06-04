import mongoose from "mongoose";

// Builds destacadas de la comunidad (PDF §9.1.3). Se diferencia de Ensamble
// por contener metadatos editoriales y ratings agregados.
// `build` es un objeto slot -> id de componente.

const communityBuildSchema = new mongoose.Schema({
    title: { type: String, required: true },
    autor: String,                       // nombre del usuario
    rating: { type: Number, min: 0, max: 5 },
    reviews: { type: Number, default: 0 }, // cantidad de reviews
    note: String,                          // descripción editorial
    build: {
        cpu: String,
        cooler: String,
        motherboard: String,
        memory: String,
        storage: String,
        gpu: String,
        psu: String,
    },
    likes: { type: Number, default: 0 },
    vistas: { type: Number, default: 0 },
    fechaCreacion: { type: Date, default: Date.now },
});

export const CommunityBuild =
    mongoose.models.CommunityBuild ||
    mongoose.model("CommunityBuild", communityBuildSchema);
