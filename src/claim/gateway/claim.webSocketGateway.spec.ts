import { SpanStatusCode, trace } from "@opentelemetry/api";
import { WsException } from "@nestjs/websockets";
import { ClaimStatus } from "../enums/claim-status.enum";
import { ClaimGateway } from "./claim.webSocketGateway";

describe("ClaimGateway", () => {
  const span = {
    setAttribute: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    spanContext: jest.fn(() => ({ traceId: "trace-123" })),
    end: jest.fn(),
  };

  const startActiveSpan = jest.fn(
    async (_name: string, callback: (activeSpan: typeof span) => unknown) =>
      callback(span),
  );

  const claimService = {
    getClaim: jest.fn(),
  };

  const jwtTokenService = {
    verifyToken: jest.fn(),
  };

  let gateway: ClaimGateway;

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(trace, "getTracer").mockReturnValue({
      startActiveSpan,
    } as any);

    gateway = new ClaimGateway(
      claimService as any,
      jwtTokenService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("authenticates a valid token before accepting the connection", async () => {
    jwtTokenService.verifyToken.mockResolvedValue({
      tokenId: "token-123",
      userId: "user-123",
      role: "USER",
    });

    const client = socketClient({
      auth: { token: "valid-token" },
    });

    const next = await runHandshakeMiddleware(client);

    expect(jwtTokenService.verifyToken).toHaveBeenCalledWith("valid-token");
    expect(client.data).toEqual({
      identityId: "user-123",
      role: "USER",
      tokenId: "token-123",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("accepts a Bearer token from the authorization header", async () => {
    jwtTokenService.verifyToken.mockResolvedValue({
      tokenId: "token-456",
      userId: "admin-123",
      role: "ADMIN",
    });

    const client = socketClient({
      headers: {
        authorization: "Bearer header-token",
      },
    });

    const next = await runHandshakeMiddleware(client);

    expect(jwtTokenService.verifyToken).toHaveBeenCalledWith("header-token");
    expect(client.data).toEqual({
      identityId: "admin-123",
      role: "ADMIN",
      tokenId: "token-456",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a connection without a token during the handshake", async () => {
    const client = socketClient();
    const next = await runHandshakeMiddleware(client);

    expect(jwtTokenService.verifyToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0] as Error & {
      data?: { code: string };
    };

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Unauthorized");
    expect(error.data).toEqual({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects an invalid or revoked token during the handshake", async () => {
    jwtTokenService.verifyToken.mockRejectedValue(
      new Error("Token revoked"),
    );

    const client = socketClient({
      auth: { token: "revoked-token" },
    });

    const next = await runHandshakeMiddleware(client);

    expect(jwtTokenService.verifyToken).toHaveBeenCalledWith(
      "revoked-token",
    );

    const error = next.mock.calls[0][0] as Error & {
      data?: { code: string };
    };

    expect(error.message).toBe("Unauthorized");
    expect(error.data).toEqual({
      code: "UNAUTHORIZED",
    });
  });

  it("traces an authenticated WebSocket connection", async () => {
    const client = socketClient();
    client.data = {
      identityId: "user-123",
      role: "USER",
      tokenId: "token-123",
    };

    await gateway.handleConnection(client as any);

    expect(startActiveSpan).toHaveBeenCalledWith(
      "websocket.connect",
      expect.any(Function),
    );
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(span.setAttribute).toHaveBeenCalledWith(
      "enduser.id",
      "user-123",
    );
    expect(span.setAttribute).toHaveBeenCalledWith(
      "enduser.role",
      "USER",
    );
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.OK,
    });
    expect(span.end).toHaveBeenCalled();
  });

  it("disconnects a connection missing authenticated state", async () => {
    const client = socketClient();

    await gateway.handleConnection(client as any);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(span.recordException).toHaveBeenCalled();
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: "WebSocket authentication state missing",
    });
  });

  it("authorizes a claim-room join by authenticated ownership", async () => {
    claimService.getClaim.mockResolvedValue({
      data: { id: "claim-123" },
    });

    const client = socketClient();
    client.data = {
      identityId: "user-123",
      role: "USER",
      tokenId: "token-123",
    };

    const result = await gateway.handleJoinRoom(
      client as any,
      "claim-123",
    );

    expect(claimService.getClaim).toHaveBeenCalledWith(
      "claim-123",
      "user-123",
    );
    expect(client.join).toHaveBeenCalledWith("claim-123");
    expect(result).toEqual({ joined: "claim-123" });
  });

  it("rejects a room join without authenticated state", async () => {
    const client = socketClient();

    await expect(
      gateway.handleJoinRoom(client as any, "claim-123"),
    ).rejects.toBeInstanceOf(WsException);

    expect(claimService.getClaim).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("rejects a room join when ownership verification fails", async () => {
    claimService.getClaim.mockRejectedValue(
      new Error("Claim not found"),
    );

    const client = socketClient();
    client.data = {
      identityId: "other-user",
      role: "USER",
      tokenId: "token-123",
    };

    await expect(
      gateway.handleJoinRoom(client as any, "claim-123"),
    ).rejects.toBeInstanceOf(WsException);

    expect(claimService.getClaim).toHaveBeenCalledWith(
      "claim-123",
      "other-user",
    );
    expect(client.join).not.toHaveBeenCalled();
  });

  it("emits claim updates only to the claim room", async () => {
    const emit = jest.fn();

    gateway.server = {
      to: jest.fn(() => ({ emit })),
    } as any;

    gateway.handleClaimStatusChanged({
      claimId: "claim-123",
      status: ClaimStatus.APPROVED,
      updatedAt: new Date("2026-07-10T19:00:00.000Z"),
      traceId: "incoming-trace",
    });

    await Promise.resolve();

    expect(gateway.server.to).toHaveBeenCalledWith("claim-123");
    expect(emit).toHaveBeenCalledWith("claim-updated", {
      claimId: "claim-123",
      status: ClaimStatus.APPROVED,
      updatedAt: new Date("2026-07-10T19:00:00.000Z"),
      traceId: "trace-123",
    });
  });

  function socketClient(
    handshakeOverrides: Record<string, unknown> = {},
  ) {
    return {
      handshake: {
        auth: {},
        headers: {},
        address: "127.0.0.1",
        ...handshakeOverrides,
      },
      data: {},
      disconnect: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
    };
  }

  async function runHandshakeMiddleware(client: ReturnType<typeof socketClient>) {
    let middleware:
      | ((socket: any, next: (error?: Error) => void) => Promise<void>)
      | undefined;

    const server = {
      use: jest.fn((registeredMiddleware) => {
        middleware = registeredMiddleware;
      }),
    };

    gateway.afterInit(server as any);

    expect(server.use).toHaveBeenCalledTimes(1);
    expect(middleware).toBeDefined();

    const next = jest.fn();

    await middleware!(client, next);

    return next;
  }
});
