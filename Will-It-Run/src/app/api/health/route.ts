import { NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getNeo4jDriver } from "@/lib/neo4j";
import { getRedis } from "@/lib/redis";

export async function GET() {
    const result = { mongo: "error", neo4j: "error", redis: "error" };

    try {
        await connectMongo();
        result.mongo = "ok";
    } catch (e) {
        console.error("MONGO ERROR:", e);
    }

    try {
        const driver = getNeo4jDriver();
        const session = driver.session();
        await session.run("RETURN 1")
        await session.close();
        result.neo4j = "ok";
    } catch {}

    try {
        await getRedis().ping();
        result.redis = "ok";
    } catch {}

    return NextResponse.json(result)
}