// src/common/logging/logger.service.ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class LoggerService {
  log(message: string, meta?: Record<string, any>) {
    const safeMeta = meta ? this.sanitize(meta) : undefined;
    const payload =
      safeMeta && typeof safeMeta === "object" && !Array.isArray(safeMeta)
        ? safeMeta
        : { meta: safeMeta };

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...payload,
      }),
    );
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => {
          const lowered = key.toLowerCase();

          if (
            lowered.includes("password") ||
            lowered.includes("token") ||
            lowered.includes("secret") ||
            lowered.includes("authorization") ||
            lowered.includes("cookie") ||
            lowered.includes("apikey") ||
            lowered.includes("api_key")
          ) {
            return [key, "[REDACTED]"];
          }

          if (item instanceof Error) {
            return [
              key,
              {
                name: item.name,
                message: item.message,
              },
            ];
          }

          return [key, this.sanitize(item)];
        }),
      );
    }

    return value;
  }
}
