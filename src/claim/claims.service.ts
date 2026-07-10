import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { trace } from "@opentelemetry/api";
import { LoggerService } from "../common/logging/logger.service";
import { MetricsService } from "../common/observability/metrics.service";
import { ClaimStatusTransitionValidator } from "./validators/claim-status-transition.validator";
import { ClaimStatus } from "./enums/claim-status.enum";
import { RedisQueueService } from "../common/redis/redis-queue.service";
import { DomainEventDispatcher } from "../common/events/domain-event.dispatcher";
import {
  CLAIM_EVENTS,
  ClaimStatusChangedEvent,
} from "../common/events/claim.events";
import { PrismaService } from "../common/database/prisma.service";
import { CreateClaimDto } from "./dto/create-claim.dto";
import { ClaimRateLimitService } from "../common/rate-limiting/claim-rate-limit.service";
import { ClaimIdempotencyService } from "../common/idempotency/claim-idempotency.service";
import { getClaimServiceConfig } from "../common/config/service-config";

@Injectable()
export class ClaimService {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
    private readonly queue: RedisQueueService,
    private readonly events: DomainEventDispatcher,
    private readonly prisma: PrismaService,
    private readonly rateLimit: ClaimRateLimitService,
    private readonly idempotency: ClaimIdempotencyService,
  ) {}

  async createClaim(
    identityId: string,
    dto: CreateClaimDto,
    idempotencyKey?: string,
  ) {
    await this.rateLimit.assertCreateAllowed(identityId);

    const key = this.idempotency.buildKey(identityId, dto, idempotencyKey);
    const existingClaimId = await this.idempotency.claimExistingClaimId(key);

    if (existingClaimId) {
      const claim = await this.getClaim(existingClaimId, identityId);

      return {
        data: claim.data,
        message: "Claim created successfully",
      };
    }

    const lockAcquired = await this.idempotency.acquirePendingLock(key);

    if (!lockAcquired) {
      const completedClaimId = await this.idempotency.waitForCompletion(key);

      if (completedClaimId) {
        const claim = await this.getClaim(completedClaimId, identityId);

        return {
          data: claim.data,
          message: "Claim created successfully",
        };
      }

      throw new BadGatewayException("Claim is already being processed");
    }

    const claimId = randomUUID();
    const correlationId = randomUUID();

    try {
      const pendingQueueSize = await this.queue.queueSize();
      const { queueBackpressureLimit } = getClaimServiceConfig();

      if (pendingQueueSize >= queueBackpressureLimit) {
        throw new ServiceUnavailableException(
          "Claim queue is temporarily overloaded",
        );
      }

      const claim = await this.prisma.claim.create({
        data: {
          id: claimId,
          identityId,
          policyId: dto.policyId ?? null,
          description: dto.description.trim(),
          amount: dto.amount ?? null,
          status: ClaimStatus.PENDING,
          correlationId,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      try {
        await this.queue.add({
          claimId,
          identityId,
          policyId: dto.policyId,
          correlationId,
        });
      } catch (error) {
        await this.prisma.claim.delete({
          where: { id: claimId },
        });

        throw error;
      }

      await this.idempotency.finalize(key, claimId);

      this.metrics.claimsCreatedTotal.inc();

      return {
        data: claim,
        message: "Claim created successfully",
      };
    } catch (error) {
      await this.idempotency.release(key);

      this.metrics.claimFailuresTotal.inc({
        stage: "claim_create",
      });

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.log("Failed to create claim", {
        identityId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new BadGatewayException("Unable to create claim");
    }
  }

  async getClaim(id: string, identityId?: string) {
    const claim = await this.prisma.claim.findFirst({
      where: identityId ? { id, identityId } : { id },
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    return {
      data: claim,
      message: "Claim fetched successfully",
    };
  }

  async getAllClaims(identityId?: string) {
    return this.prisma.claim.findMany({
      where: identityId ? { identityId } : undefined,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });
  }

  /**
   * ONLY DOMAIN RESPONSIBILITY:
   * enforce claim state transitions
   */
  async updateClaimStatus(id: string, nextStatus: ClaimStatus) {
    const current = await this.prisma.claim.findUnique({
      where: { id },
    });

    if (!current) {
      this.metrics.claimFailuresTotal.inc({
        stage: "claim_not_found",
      });

      throw new NotFoundException(`Claim not found`);
    }

    ClaimStatusTransitionValidator.validate(
      current.status as ClaimStatus,
      nextStatus,
    );

    const updated = await this.prisma.claim.updateMany({
      where: {
        id,
        version: current.version,
      },
      data: {
        status: nextStatus,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      this.metrics.claimFailuresTotal.inc({
        stage: "optimistic_lock",
      });

      throw new BadRequestException("Concurrent update detected");
    }

    const newClaim = await this.prisma.claim.findUnique({
      where: { id },
    });

    this.metrics.claimStatusTransitionsTotal.inc({
      from: current.status,
      to: nextStatus,
    });

    this.events.emit<ClaimStatusChangedEvent>(CLAIM_EVENTS.STATUS_CHANGED, {
      claimId: id,
      status: nextStatus,
      updatedAt: new Date(),
      traceId: trace.getActiveSpan()?.spanContext().traceId,
    });

    this.logger.log("Claim status updated", {
      id,
      from: current.status,
      to: nextStatus,
    });

    return newClaim;
  }
}
