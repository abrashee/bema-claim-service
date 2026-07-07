import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { ClaimService } from "../claims.service";
import { LoggerService } from "../../common/logging/logger.service";
import { MetricsService } from "../../common/observability/metrics.service";
import { ClaimStatus } from "../enums/claim-status.enum";
import { RedisQueueService } from "../../common/redis/redis-queue.service";

type QueuePayload = {
  claimId: string;
  identityId: string;
  policyId?: string;
  correlationId: string;
};

@Injectable()
export class FraudWorker implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly claimService: ClaimService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
    private readonly queue: RedisQueueService,
  ) {}

  private isRunning = true;

  onModuleInit() {
    void this.start();
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  async start() {
    while (this.isRunning) {
      const payload = await this.queue.getNext();

      if (!this.isRunning) break;

      if (!payload) {
        await this.delay(500);
        continue;
      }

      await this.processClaim(payload);
    }
  }

  private async processClaim(payload: QueuePayload) {
    if (!this.isRunning) return;

    const { claimId } = payload;
    const tracer = trace.getTracer("fraud-worker");
    const span = tracer.startSpan("processClaim");
    const start = Date.now();

    try {
      const claimResponse = await this.claimService.getClaim(claimId);
      const claim = claimResponse.data;
      const claimStatus = claim.status as ClaimStatus;

      if (
        claimStatus === ClaimStatus.APPROVED ||
        claimStatus === ClaimStatus.REJECTED
      ) {
        this.logger.log("Skipping terminal claim", {
          claimId,
          status: claimStatus,
        });

        return;
      }

      await this.claimService.updateClaimStatus(
        claimId,
        ClaimStatus.PROCESSING,
      );

      await this.delay(1000);

      await this.claimService.updateClaimStatus(
        claimId,
        ClaimStatus.FRAUD_CHECKING,
      );

      await this.delay(1000);

      const result = this.determineFraudDecision(claimId);

      await this.claimService.updateClaimStatus(claimId, result);

      const durationMs = Date.now() - start;

      this.metrics.claimProcessingDuration.observe(durationMs);

      this.logger.log("Worker processed claim", {
        claimId,
        identityId: payload.identityId,
        policyId: payload.policyId,
        result,
        durationMs,
        traceId: span.spanContext().traceId,
      });
    } catch (error) {
      this.metrics.claimFailuresTotal.inc({
        stage: "fraud_worker",
      });

      const retryCount = await this.queue.incrementRetry(claimId);
      const canRetry = await this.queue.canRetry(claimId);

      if (canRetry) {
        await this.queue.requeue(payload.claimId);

        this.logger.log("Worker requeued failed claim", {
          claimId,
          attempt: retryCount,
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        this.metrics.claimFailuresTotal.inc({
          stage: "fraud_worker_dlq",
        });

        await this.queue.moveToDLQ(payload.claimId);

        this.logger.log("Worker moved claim to DLQ", {
          claimId,
          attempts: retryCount,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      span.end();
      await this.queue.clearPending(claimId);
    }
  }

  private determineFraudDecision(claimId: string): ClaimStatus {
    const hash = claimId
      .split("")
      .reduce((acc, character) => acc + character.charCodeAt(0), 0);

    return hash % 2 === 0 ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
