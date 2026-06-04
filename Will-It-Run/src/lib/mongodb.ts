import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

let cached = (global as unknown as { _mongoose: { conn: unknown; promise: unknown } })._mongoose;

if (!cached) {
    cached = (global as unknown as { _mongoose: { conn: unknown; promise: unknown } })._mongoose = { conn: null, promise: null }; }


export async function connectMongo() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}