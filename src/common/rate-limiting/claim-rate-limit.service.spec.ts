import { HttpStatus } from "@nestjs/common";
import { resetClaimServiceConfig } from "../config/service-config";
import { ClaimRateLimitService } from "./claim-rate-limit.service";

describe("ClaimRateLimitService", () => {
  const redis = {
    incr: jest.fn(),
    pexpire: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLAIM_CREATE_RATE_LIMIT = "2";
    process.env.CLAIM_CREATE_RATE_WINDOW_MS = "1000";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.REDIS_HOST = "redis";
    process.env.REDIS_PORT = "6379";
    process.env.REQUEST_BODY_LIMIT = "64kb";
    process.env.WEBSOCKET_ORIGIN = "http://localhost:4200";
    process.env.USER_SERVICE_URL = "http://user-service:8081";
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      "http://otel-collector:4318/v1/traces";
    process.env.CLAIM_QUEUE_BACKPRESSURE_LIMIT = "100";
    resetClaimServiceConfig();
  });

  it("allows requests within the limit", async () => {
    redis.incr.mockResolvedValueOnce(1);
    const service = new ClaimRateLimitService(redis);

    await expect(
      service.assertCreateAllowed("user-1"),
    ).resolves.toBeUndefined();
    expect(redis.pexpire).toHaveBeenCalledWith(expect.any(String), 1000);
  });

  it("rejects requests over the limit", async () => {
    redis.incr.mockResolvedValueOnce(3);
    const service = new ClaimRateLimitService(redis);

    await expect(service.assertCreateAllowed("user-1")).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });
});
