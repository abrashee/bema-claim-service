import { Module } from "@nestjs/common";
import { RedisProvider } from "./redis.provider";
import { RedisQueueService } from "./redis-queue.service";

@Module({
  providers: [RedisProvider, RedisQueueService],
  exports: [RedisProvider, RedisQueueService],
})
export class RedisModule {}
