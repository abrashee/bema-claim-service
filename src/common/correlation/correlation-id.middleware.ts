import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { CorrelationContextService } from "./correlation-context.service";

const CORRELATION_ID_HEADER = "X-Correlation-ID";
const VALID_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  constructor(
    private readonly correlationContext: CorrelationContextService,
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const supplied = request.header(CORRELATION_ID_HEADER);
    const correlationId =
      supplied && VALID_CORRELATION_ID.test(supplied)
        ? supplied
        : randomUUID();

    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.correlationContext.run(correlationId, () => {
      this.logger.log(
        `Incoming request method=${request.method} path=${request.path}`,
      );
      next();
    });
  }
}
