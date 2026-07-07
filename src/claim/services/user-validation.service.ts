// src / claim / services / user-validation.service.ts
/**
 * USER VALIDATION CONTRACT
 *
 * This service is intentionally fail-closed.
 *
 * Claim creation should not proceed if the user service cannot confirm identity.
 */

import { Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { LoggerService } from "../../common/logging/logger.service";
import { UserCacheService } from "./user-cache.service";
import { MetricsService } from "../../common/observability/metrics.service";
import { getClaimServiceConfig } from "../../common/config/service-config";

@Injectable()
export class UserValidationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
    private readonly cache: UserCacheService,
    private readonly metrics: MetricsService,
  ) {}

  async validateUserExists(userId: string): Promise<boolean> {
    // 1. CACHE FIRST (fast path)
    const cached = this.cache.get(userId);
    if (cached !== null) {
      return cached;
    }

    // 2. HTTP CALL (best effort)
    try {
      const config = getClaimServiceConfig();
      const response = await this.httpService.axiosRef.get(
        `${config.userServiceUrl}/api/v1/users/${encodeURIComponent(userId)}`,
        {
          timeout: 3000,
          validateStatus: (status) => status >= 200 && status < 500,
        },
      );

      const exists = response.status === 200;

      this.cache.set(userId, exists);

      return exists;
    } catch (error) {
      this.logger.log("User validation failed (fail-closed mode)", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      this.metrics.claimFailuresTotal.inc({
        stage: "user_validation",
      });

      this.cache.set(userId, false);

      return false;
    }
  }
}
