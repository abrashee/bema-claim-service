// src / claim / claim.module.ts
import { Module } from "@nestjs/common";
import { ClaimService } from "./claims.service";
import { FraudWorker } from "./workers/fraud.worker";
import { ClaimController } from "./claim.controller";
import { LoggingModule } from "../common/logging/logging.module";
import { ClaimGateway } from "./gateway/claim.webSocketGateway";
import { ObservabilityModule } from "../common/observability/observability.module";
import { RedisModule } from "../common/redis/redis.module";
import { DomainEventModule } from "../common/events/domain-event.module";
import { DatabaseModule } from "../common/database/database.module";
import { ClaimAuthGuard } from "../common/auth/claim-auth.guard";
import { JwtTokenService } from "../common/auth/jwt-token.service";
import { AccessTokenRevocationService } from "../common/auth/access-token-revocation.service";
import { ClaimRateLimitService } from "../common/rate-limiting/claim-rate-limit.service";
import { ClaimIdempotencyService } from "../common/idempotency/claim-idempotency.service";

@Module({
  imports: [
    LoggingModule,
    ObservabilityModule,
    RedisModule,
    DomainEventModule,
    DatabaseModule,
  ],
  controllers: [ClaimController],
  providers: [
    ClaimService,
    FraudWorker,
    ClaimGateway,
    ClaimAuthGuard,
    AccessTokenRevocationService,
    JwtTokenService,
    ClaimRateLimitService,
    ClaimIdempotencyService,
  ],
  exports: [ClaimService],
})
export class ClaimModule {}
