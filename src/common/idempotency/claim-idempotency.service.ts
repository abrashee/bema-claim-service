import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { createHash } from "crypto";
import { CreateClaimDto } from "../../claim/dto/create-claim.dto";

type StoredIdempotencyState = {
  status: "pending" | "complete";
  claimId?: string;
};

@Injectable()
export class ClaimIdempotencyService {
  private readonly pendingTtlMs = 60_000;
  private readonly completeTtlSeconds = 60 * 60 * 24;

  constructor(@Inject("REDIS_CLIENT") private readonly client: Redis) {}

  buildKey(
    identityId: string,
    dto: CreateClaimDto,
    idempotencyKey?: string,
  ): string {
    const rawKey = idempotencyKey?.trim() || this.fingerprint(dto);
    const safeKey = rawKey.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 128);

    return `claims:idempotency:${identityId}:${safeKey}`;
  }

  async claimExistingClaimId(key: string): Promise<string | null> {
    const state = await this.readState(key);

    if (state?.status === "complete" && state.claimId) {
      return state.claimId;
    }

    return null;
  }

  async acquirePendingLock(key: string): Promise<boolean> {
    const acquired = await this.client.setnx(
      key,
      JSON.stringify({ status: "pending" }),
    );

    if (acquired === 0) {
      return false;
    }

    await this.client.pexpire(key, this.pendingTtlMs);

    return true;
  }

  async waitForCompletion(
    key: string,
    timeoutMs = 2_000,
  ): Promise<string | null> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const existing = await this.claimExistingClaimId(key);
      if (existing) {
        return existing;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  async finalize(key: string, claimId: string): Promise<void> {
    const state: StoredIdempotencyState = { status: "complete", claimId };
    await this.client.setex(
      key,
      this.completeTtlSeconds,
      JSON.stringify(state),
    );
  }

  async release(key: string): Promise<void> {
    await this.client.del(key);
  }

  private async readState(key: string): Promise<StoredIdempotencyState | null> {
    const raw = await this.client.get(key);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredIdempotencyState>;
      if (parsed.status === "pending") {
        return { status: "pending" };
      }

      if (parsed.status === "complete" && typeof parsed.claimId === "string") {
        return { status: "complete", claimId: parsed.claimId };
      }

      return null;
    } catch {
      return null;
    }
  }

  private fingerprint(dto: CreateClaimDto): string {
    const normalized = JSON.stringify({
      policyId: dto.policyId ?? null,
      description: dto.description.trim(),
      amount: dto.amount ?? null,
    });

    return createHash("sha256").update(normalized).digest("hex");
  }
}
