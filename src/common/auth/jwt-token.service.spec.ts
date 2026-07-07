import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "crypto";
import { resetClaimServiceConfig } from "../config/service-config";
import { JwtTokenService } from "./jwt-token.service";

describe("JwtTokenService", () => {
  const secret = "a".repeat(32);
  const tokenService = new JwtTokenService();

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
    process.env.REDIS_HOST = "redis";
    process.env.REDIS_PORT = "6379";
    process.env.CLAIM_CREATE_RATE_LIMIT = "2";
    process.env.CLAIM_CREATE_RATE_WINDOW_MS = "1000";
    process.env.CLAIM_QUEUE_BACKPRESSURE_LIMIT = "100";
    process.env.REQUEST_BODY_LIMIT = "64kb";
    process.env.WEBSOCKET_ORIGIN = "http://localhost:4200";
    process.env.USER_SERVICE_URL = "http://user-service:8081";
    resetClaimServiceConfig();
  });

  it("verifies a valid token", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    const verified = tokenService.verifyToken(
      `${header}.${payload}.${signature}`,
    );

    expect(verified.userId).toBe("user-123");
  });

  it("rejects a tampered token", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-123" })).toString(
      "base64url",
    );
    const signature = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "user-456" }),
    ).toString("base64url");

    expect(() =>
      tokenService.verifyToken(`${header}.${tamperedPayload}.${signature}`),
    ).toThrow(UnauthorizedException);
  });
});
