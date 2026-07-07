import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { getClaimServiceConfig } from "../config/service-config";

interface JwtHeader {
  alg?: string;
  typ?: string;
}

interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface VerifiedToken {
  userId: string;
  payload: JwtPayload;
}

@Injectable()
export class JwtTokenService {
  verifyBearerToken(authorizationHeader: string | undefined): VerifiedToken {
    const token = this.extractToken(authorizationHeader);

    return this.verifyToken(token);
  }

  verifyToken(token: string): VerifiedToken {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    const header = this.decodeJson<JwtHeader>(encodedHeader, "token header");

    if (header.alg !== "HS256") {
      throw new UnauthorizedException("Unsupported token algorithm");
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac(
      "sha256",
      getClaimServiceConfig().jwtSecret,
    )
      .update(signingInput)
      .digest("base64url");

    const actualSignature = Buffer.from(encodedSignature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
      actualSignature.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(actualSignature, expectedSignatureBuffer)
    ) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    const payload = this.decodeJson<JwtPayload>(
      encodedPayload,
      "token payload",
    );

    if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    if (typeof payload.exp === "number") {
      const expiresAt = payload.exp * 1000;

      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        throw new UnauthorizedException("Token expired");
      }
    }

    return {
      userId: payload.sub,
      payload,
    };
  }

  private extractToken(authorizationHeader: string | undefined): string {
    if (!authorizationHeader) {
      throw new UnauthorizedException("Missing authorization token");
    }

    const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    return token;
  }

  private decodeJson<T>(value: string, partName: string): T {
    try {
      return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
    } catch {
      throw new UnauthorizedException(`Invalid ${partName}`);
    }
  }
}
