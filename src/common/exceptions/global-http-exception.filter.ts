import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { LoggerService } from "../logging/logger.service";

type HttpExceptionResponse =
  | string
  | {
      message?: string | string[];
      error?: string;
      statusCode?: number;
    };

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status = this.resolveStatus(exception, request);
    const message = this.resolveMessage(exception, status);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error("Unhandled HTTP exception", {
        method: request.method,
        path: request.originalUrl ?? request.url,
        status,
        exception,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      data: null,
    });
  }

  private resolveStatus(
    exception: unknown,
    request: Request,
  ): number {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (
      status === HttpStatus.NOT_FOUND &&
      this.isKnownPathWithUnsupportedMethod(request)
    ) {
      return HttpStatus.METHOD_NOT_ALLOWED;
    }

    return status;
  }

  private isKnownPathWithUnsupportedMethod(request: Request): boolean {
    const path = request.path ?? request.url.split("?")[0];

    const allowedMethods = new Map<string, readonly string[]>([
      ["/", ["GET"]],
      ["/api/claims", ["GET", "POST"]],
      ["/api/claims/actuator/health", ["GET"]],
      ["/actuator/health", ["GET"]],
      ["/actuator/prometheus", ["GET"]],
    ]);

    const exactMethods = allowedMethods.get(path);

    if (exactMethods) {
      return !exactMethods.includes(request.method);
    }

    if (
      /^\/api\/claims\/[^/]+$/.test(path) &&
      path !== "/api/claims/actuator"
    ) {
      return request.method !== "GET";
    }

    return false;
  }

  private resolveMessage(
    exception: unknown,
    status: number,
  ): string | string[] {
    if (status === HttpStatus.METHOD_NOT_ALLOWED) {
      return "Method not allowed";
    }

    if (!(exception instanceof HttpException)) {
      return "An unexpected error occurred";
    }

    const exceptionResponse =
      exception.getResponse() as HttpExceptionResponse;

    if (typeof exceptionResponse === "string") {
      return exceptionResponse;
    }

    if (
      exceptionResponse &&
      typeof exceptionResponse === "object" &&
      exceptionResponse.message
    ) {
      return exceptionResponse.message;
    }

    return status >= HttpStatus.INTERNAL_SERVER_ERROR
      ? "An unexpected error occurred"
      : exception.message;
  }
}
