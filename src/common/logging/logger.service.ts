// src/common/logging/logger.service.ts
import {
  Injectable,
  LoggerService as NestLoggerService,
  LogLevel,
} from "@nestjs/common";
import { CorrelationContextService } from "../correlation/correlation-context.service";

type LogMetadata = Record<string, unknown>;

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    private readonly correlationContext: CorrelationContextService,
  ) {}

  log(message: unknown, metaOrContext?: LogMetadata | string) {
    this.write("log", message, metaOrContext);
  }

  error(
    message: unknown,
    traceOrMeta?: string | LogMetadata,
    context?: string,
  ) {
    const metadata =
      traceOrMeta && typeof traceOrMeta === "object"
        ? traceOrMeta
        : traceOrMeta
          ? { stack: traceOrMeta }
          : undefined;

    this.write("error", message, metadata, context);
  }

  warn(message: unknown, metaOrContext?: LogMetadata | string) {
    this.write("warn", message, metaOrContext);
  }

  debug(message: unknown, metaOrContext?: LogMetadata | string) {
    this.write("debug", message, metaOrContext);
  }

  verbose(message: unknown, metaOrContext?: LogMetadata | string) {
    this.write("verbose", message, metaOrContext);
  }

  fatal(message: unknown, metaOrContext?: LogMetadata | string) {
    this.write("fatal", message, metaOrContext);
  }

  setLogLevels(_levels: LogLevel[]) {
    // Log-level filtering is controlled by the runtime/container configuration.
  }

  private write(
    level: string,
    message: unknown,
    metaOrContext?: LogMetadata | string,
    explicitContext?: string,
  ) {
    const context =
      explicitContext ??
      (typeof metaOrContext === "string" ? metaOrContext : undefined);

    const metadata =
      metaOrContext &&
      typeof metaOrContext === "object" &&
      !Array.isArray(metaOrContext)
        ? this.sanitize(metaOrContext)
        : undefined;

    const payload =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : metadata === undefined
          ? {}
          : { meta: metadata };

    const output = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "bema-claim-service",
      ...(this.correlationContext.getCorrelationId()
        ? { correlationId: this.correlationContext.getCorrelationId() }
        : {}),
      message:
        typeof message === "string"
          ? message
          : JSON.stringify(this.sanitize(message)),
      ...(context ? { context } : {}),
      ...payload,
    });

    if (level === "error" || level === "fatal") {
      console.error(output);
      return;
    }

    if (level === "warn") {
      console.warn(output);
      return;
    }

    console.log(output);
  }

  private sanitize(value: unknown): unknown {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
      };
    }

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

          return [key, this.sanitize(item)];
        }),
      );
    }

    return value;
  }
}
