import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { getClaimServiceConfig } from "../config/service-config";

@Injectable()
export class ClaimRateLimitService {
  constructor(@Inject("REDIS_CLIENT") private readonly client: Redis) {}

  async assertCreateAllowed(identityId: string): Promise<void> {
    const config = getClaimServiceConfig();
    const windowKey = Math.floor(Date.now() / config.createClaimRateWindowMs);
    const key = `claims:rate:create:${identityId}:${windowKey}`;

    const count = await this.client.incr(key);

    if (count === 1) {
      await this.client.pexpire(key, config.createClaimRateWindowMs);
    }

    if (count > config.createClaimRateLimit) {
      throw new HttpException(
        "Too many claim creation requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
