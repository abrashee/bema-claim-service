// src/common/queue/redis-queue.service.ts
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { createHash } from "crypto";
import Redis from "ioredis";

@Injectable()
export class RedisQueueService implements OnModuleDestroy {
  private readonly QUEUE_KEY = "claims:queue";
  private readonly DLQ_KEY = "claims:dlq";
  private readonly RETRY_KEY = "claims:retry";
  private readonly PENDING_KEY_PREFIX = "claims:pending:";
  private readonly PAYLOAD_KEY_PREFIX = "claims:payload:";
  private readonly PAYLOAD_TTL_SECONDS = 60 * 60 * 24;

  constructor(@Inject("REDIS_CLIENT") private readonly client: Redis) {}

  async add(payload: {
    claimId: string;
    identityId: string;
    policyId?: string;
    correlationId: string;
  }) {
    const pendingKey = this.pendingKey(payload.claimId);
    const payloadKey = this.payloadKey(payload.claimId);
    const payloadValue = JSON.stringify({
      claimId: payload.claimId,
      identityId: payload.identityId,
      policyId: payload.policyId,
      correlationId: payload.correlationId,
    });
    const inserted = await this.client.setnx(
      pendingKey,
      this.hashPayload(payloadValue),
    );

    if (inserted === 0) {
      return;
    }

    await this.client.pexpire(pendingKey, this.PAYLOAD_TTL_SECONDS * 1000);

    await this.client.setex(payloadKey, this.PAYLOAD_TTL_SECONDS, payloadValue);
    await this.client.lpush(this.QUEUE_KEY, payload.claimId);
  }

  async getNext(): Promise<{
    claimId: string;
    identityId: string;
    policyId?: string;
    correlationId: string;
  } | null> {
    const claimId = await this.client.rpop(this.QUEUE_KEY);

    if (!claimId) return null;

    const rawPayload = await this.client.get(this.payloadKey(claimId));

    if (!rawPayload) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawPayload) as {
        claimId: string;
        identityId: string;
        policyId?: string;
        correlationId: string;
      };

      if (
        typeof parsed.claimId !== "string" ||
        typeof parsed.identityId !== "string" ||
        typeof parsed.correlationId !== "string"
      ) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  async incrementRetry(claimId: string): Promise<number> {
    return await this.client.hincrby(this.RETRY_KEY, claimId, 1);
  }

  async getRetryCount(claimId: string): Promise<number> {
    const value = await this.client.hget(this.RETRY_KEY, claimId);
    return value ? Number(value) : 0;
  }

  async canRetry(claimId: string, max = 3): Promise<boolean> {
    const count = await this.getRetryCount(claimId);
    return count < max;
  }

  async moveToDLQ(claimId: string) {
    await this.client.lpush(this.DLQ_KEY, claimId);
    await this.client.hdel(this.RETRY_KEY, claimId);
  }

  async requeue(claimId: string) {
    await this.client.lpush(this.QUEUE_KEY, claimId);
  }

  async clearPending(claimId: string) {
    await this.client.del(this.pendingKey(claimId));
  }

  async pendingCount() {
    return this.client.dbsize();
  }

  async queueSize() {
    return await this.client.llen(this.QUEUE_KEY);
  }

  async dlqSize() {
    return await this.client.llen(this.DLQ_KEY);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private pendingKey(claimId: string) {
    return `${this.PENDING_KEY_PREFIX}${claimId}`;
  }

  private payloadKey(claimId: string) {
    return `${this.PAYLOAD_KEY_PREFIX}${claimId}`;
  }

  private hashPayload(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
}
