import {
  ArgumentsHost,
  BadRequestException,
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
