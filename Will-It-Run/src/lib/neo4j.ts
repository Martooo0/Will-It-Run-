import neo4j, { Driver } from "neo4j-driver";

const globalForNeo4j = global as unknown as { _neo4jDriver: Driver };

export function getNeo4jDriver(): Driver {
    if (!globalForNeo4j._neo4jDriver) {
        globalForNeo4j._neo4jDriver = neo4j.driver(
            process.env.NEO4J_URI!,
            neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
        );
    }
    return globalForNeo4j._neo4jDriver;
}