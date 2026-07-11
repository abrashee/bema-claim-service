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

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

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

  private resolveMessage(
    exception: unknown,
    status: number,
  ): string | string[] {
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
