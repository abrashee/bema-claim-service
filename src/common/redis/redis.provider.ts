import Redis from "ioredis";
import { getClaimServiceConfig } from "../config/service-config";

export const RedisProvider = {
  provide: "REDIS_CLIENT",
  useFactory: async () => {
    const config = getClaimServiceConfig();

    const client = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      connectTimeout: config.redisConnectTimeoutMs,
      commandTimeout: config.redisConnectTimeoutMs,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      enableReadyCheck: true,
      lazyConnect: true,
      keepAlive: 10_000,

      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });

    await client.connect();
    return client;
  },
};
