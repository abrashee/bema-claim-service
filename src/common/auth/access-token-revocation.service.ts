import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class AccessTokenRevocationService {
  private static readonly KEY_PREFIX = "auth:revoked-access-token:";

  constructor(
    @Inject("REDIS_CLIENT")
    private readonly redisClient: Redis,
  ) {}

  async isRevoked(tokenId: string): Promise<boolean> {
    if (!tokenId || tokenId.trim().length === 0) {
      return false;
    }

    const exists = await this.redisClient.exists(
      `${AccessTokenRevocationService.KEY_PREFIX}${tokenId}`,
    );

    return exists === 1;
  }
}
