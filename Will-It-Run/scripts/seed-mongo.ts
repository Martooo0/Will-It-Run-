import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectMongo } from "../src/lib/mongodb";
import { Component } from "../src/lib/models/Component";
import { Ensamble } from "../src/lib/models/Ensamble";
import { CommunityBuild } from "../src/lib/models/CommunityBuild";
import { Review } from "../src/lib/models/Review";

// Siembra las 4 colecciones documentales (PDF §9.1) desde data/*.json.
// Cada archivo es opcional: si todavía no existe, esa colección se saltea
// (útil mientras el equipo arma el dataset por partes).

const DATA_DIR = path.join(process.cwd(), "data");

// modelo Mongoose <- archivo JSON en data/
const COLECCIONES = [
    { model: Component, file: "components.json", label: "componentes" },
    { model: Ensamble, file: "builds.json", label: "ensambles" },
    { model: CommunityBuild, file: "community-builds.json", label: "community builds" },
    { model: Review, file: "reviews.json", label: "reviews" },
] as const;

function leerJson(file: string): unknown[] | null {
    const full = path.join(DATA_DIR, file);
    if (!fs.existsSync(full)) return null;
    return JSON.parse(fs.readFileSync(full, "utf-8"));
}

async function main() {
    await connectMongo();

    for (const { model, file, label } of COLECCIONES) {
        const docs = leerJson(file);
        if (docs === null) {
            console.log(`- ${label}: sin data/${file}, se saltea.`);
            continue;
        }
        await model.deleteMany({});
        await model.insertMany(docs);
        console.log(`✓ ${label}: ${docs.length} documentos insertados.`);
    }

    console.log("Seed de MongoDB terminado.");
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error("Error en seed-mongo:", e);
    process.exit(1);
});
