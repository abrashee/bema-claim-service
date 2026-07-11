import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
  HttpStatus,
} from "@nestjs/common";
import { GlobalHttpExceptionFilter } from "./global-http-exception.filter";

describe("GlobalHttpExceptionFilter", () => {
  const status = jest.fn();
  const json = jest.fn();
  const logger = {
    error: jest.fn(),
  };

  const request = {
    method: "GET",
    path: "/api/claims/test",
    originalUrl: "/api/claims/test",
    url: "/api/claims/test",
  };

  const response = {
    status,
    json,
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  const filter = new GlobalHttpExceptionFilter(logger as any);

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue(response);
    request.method = "GET";
    request.path = "/api/claims/test";
    request.originalUrl = "/api/claims/test";
    request.url = "/api/claims/test";
  });

  it("preserves intentional HTTP exceptions", () => {
    filter.catch(new BadRequestException("Invalid request"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: "Invalid request",
      data: null,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("maps unsupported methods on known routes to 405", () => {
    request.method = "POST";
    request.path = "/";
    request.originalUrl = "/";
    request.url = "/";

    filter.catch(new NotFoundException("Cannot POST /"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.METHOD_NOT_ALLOWED);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.METHOD_NOT_ALLOWED,
      message: "Method not allowed",
      data: null,
    });
  });

  it("maps missing claims to not found", () => {
    filter.catch(new NotFoundException("Claim not found"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      message: "Claim not found",
      data: null,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns a safe response and logs unexpected exceptions", () => {
    filter.catch(
      new Error("database password appeared in an internal error"),
      host,
    );

    expect(status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
      data: null,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "Unhandled HTTP exception",
      expect.objectContaining({
        method: "GET",
        path: "/api/claims/test",
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      }),
    );
  });
});
