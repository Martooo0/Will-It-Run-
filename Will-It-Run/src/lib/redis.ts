import Redis from "ioredis";

const globalForRedis = global as unknown as { _redis: Redis };

export function getRedis(): Redis {
    if (!globalForRedis._redis) {
        globalForRedis._redis = new Redis(process.env.REDIS_URL!);
    }
    return globalForRedis._redis;
}