import mongoose from "mongoose";

// Reseñas y reportes de problemas sobre componentes o builds (PDF §9.1.4).

export const TIPOS_REVIEW = ["review", "reporte_problema"] as const;
export const TARGET_TYPES = ["componente", "build"] as const;

const reviewSchema = new mongoose.Schema({
    tipo: { type: String, enum: TIPOS_REVIEW, required: true },
    targetId: { type: String, required: true },   // id del componente o build
    targetType: { type: String, enum: TARGET_TYPES, required: true },
    autor: String,
    rating: { type: Number, min: 1, max: 5 },
    comentario: String,
    fechaCreacion: { type: Date, default: Date.now },
});

// Índice de apoyo para la query "reseñas de una build/componente".
reviewSchema.index({ targetType: 1, targetId: 1 });

export const Review =
    mongoose.models.Review || mongoose.model("Review", reviewSchema);
