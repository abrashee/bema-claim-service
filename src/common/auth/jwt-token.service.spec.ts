import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "crypto";
import { resetClaimServiceConfig } from "../config/service-config";
import { AccessTokenRevocationService } from "./access-token-revocation.service";
import { JwtTokenService } from "./jwt-token.service";

describe("JwtTokenService", () => {
  const secret = "a".repeat(32);

  const accessTokenRevocationService = {
    isRevoked: jest.fn(),
  };

  const tokenService = new JwtTokenService(
    accessTokenRevocationService as unknown as AccessTokenRevocationService,
  );

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

  beforeEach(() => {
    jest.clearAllMocks();
    accessTokenRevocationService.isRevoked.mockResolvedValue(false);
  });

  function createToken(payload: Record<string, unknown>): string {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");

    const encodedPayload = Buffer.from(
      JSON.stringify(payload),
    ).toString("base64url");

    const signature = createHmac("sha256", secret)
      .update(`${header}.${encodedPayload}`)
      .digest("base64url");

    return `${header}.${encodedPayload}.${signature}`;
  }

  it("verifies a valid active token", async () => {
    const token = createToken({
      jti: "token-123",
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    const verified = await tokenService.verifyToken(token);

    expect(verified.tokenId).toBe("token-123");
    expect(verified.userId).toBe("user-123");
    expect(accessTokenRevocationService.isRevoked).toHaveBeenCalledWith(
      "token-123",
    );
  });

  it("rejects a revoked token", async () => {
    accessTokenRevocationService.isRevoked.mockResolvedValue(true);

    const token = createToken({
      jti: "revoked-token",
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(tokenService.verifyToken(token)).rejects.toThrow(
      "Token revoked",
    );
  });

  it("rejects a token without a jti", async () => {
    const token = createToken({
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    await expect(tokenService.verifyToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(accessTokenRevocationService.isRevoked).not.toHaveBeenCalled();
  });

  it("rejects a tampered token", async () => {
    const token = createToken({
      jti: "token-123",
      sub: "user-123",
    });

    const [header, , signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        jti: "token-123",
        sub: "user-456",
      }),
    ).toString("base64url");

    await expect(
      tokenService.verifyToken(`${header}.${tamperedPayload}.${signature}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an expired token", async () => {
    const token = createToken({
      jti: "expired-token",
      sub: "user-123",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    await expect(tokenService.verifyToken(token)).rejects.toThrow(
      "Token expired",
    );

    expect(accessTokenRevocationService.isRevoked).not.toHaveBeenCalled();
  });
});
