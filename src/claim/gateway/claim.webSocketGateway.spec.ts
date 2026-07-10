import { SpanStatusCode, trace } from "@opentelemetry/api";
import { WsException } from "@nestjs/websockets";
import { ClaimStatus } from "../enums/claim-status.enum";
import { ClaimGateway } from "./claim.webSocketGateway";

describe("ClaimGateway tracing", () => {
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

  const gateway = new ClaimGateway(
    claimService as any,
    jwtTokenService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(trace, "getTracer").mockReturnValue({
      startActiveSpan,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("traces a successful WebSocket connection", async () => {
    jwtTokenService.verifyToken.mockReturnValue({ userId: "user-123" });

    const client = {
      handshake: {
        auth: { token: "token" },
        headers: {},
        address: "127.0.0.1",
      },
      data: {},
      disconnect: jest.fn(),
    };

    gateway.handleConnection(client as any);

    await Promise.resolve();

    expect(startActiveSpan).toHaveBeenCalledWith(
      "websocket.connect",
      expect.any(Function),
    );
    expect(client.data).toEqual({ identityId: "user-123" });
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.OK,
    });
    expect(span.end).toHaveBeenCalled();
  });

  it("traces and disconnects an unauthorized WebSocket connection", async () => {
    jwtTokenService.verifyToken.mockImplementation(() => {
      throw new Error("invalid token");
    });

    const client = {
      handshake: {
        auth: { token: "invalid" },
        headers: {},
        address: "127.0.0.1",
      },
      data: {},
      disconnect: jest.fn(),
    };

    gateway.handleConnection(client as any);

    await Promise.resolve();

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(span.recordException).toHaveBeenCalled();
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: "WebSocket authentication failed",
    });
    expect(span.end).toHaveBeenCalled();
  });

  it("traces an authorized claim-room join", async () => {
    claimService.getClaim.mockResolvedValue({
      data: { id: "claim-123" },
    });

    const client = {
      data: { identityId: "user-123" },
      join: jest.fn().mockResolvedValue(undefined),
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
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.OK,
    });
  });

  it("traces and rejects an unauthorized claim-room join", async () => {
    const client = {
      data: {},
      join: jest.fn(),
    };

    await expect(
      gateway.handleJoinRoom(client as any, "claim-123"),
    ).rejects.toBeInstanceOf(WsException);

    expect(client.join).not.toHaveBeenCalled();
    expect(span.recordException).toHaveBeenCalled();
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: "Claim room authorization failed",
    });
  });

  it("traces an outbound claim update and emits the active trace ID", async () => {
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
    expect(span.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.OK,
    });
    expect(span.end).toHaveBeenCalled();
  });
});
