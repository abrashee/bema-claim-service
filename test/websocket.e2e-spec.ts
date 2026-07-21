import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { io, Socket } from "socket.io-client";
import { ClaimGateway } from "../src/claim/gateway/claim.webSocketGateway";
import { ClaimService } from "../src/claim/claims.service";
import { JwtTokenService } from "../src/common/auth/jwt-token.service";
import { ClaimStatus } from "../src/claim/enums/claim-status.enum";

describe("Claim WebSocket E2E", () => {
  let app: INestApplication;
  let gateway: ClaimGateway;
  let client: Socket;

  const claimService = {
    getClaim: jest.fn().mockResolvedValue({
      data: {
        id: "claim-123",
      },
    }),
  };

  const jwtTokenService = {
    verifyToken: jest.fn().mockResolvedValue({
      tokenId: "token-123",
      userId: "user-123",
      role: "USER",
    }),
  };

  beforeAll(async () => {
    process.env.WEBSOCKET_ORIGIN = "http://localhost:4200";

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        providers: [
          ClaimGateway,
          {
            provide: ClaimService,
            useValue: claimService,
          },
          {
            provide: JwtTokenService,
            useValue: jwtTokenService,
          },
        ],
      })
        .overrideProvider(ClaimService)
        .useValue(claimService)
        .overrideProvider(JwtTokenService)
        .useValue(jwtTokenService)
        .compile();

    app = moduleFixture.createNestApplication();

    app.useWebSocketAdapter(new IoAdapter(app));

    await app.listen(0);

    gateway = app.get(ClaimGateway);

    client = io(`http://localhost:${(app.getHttpServer().address()).port}`, {
      transports: ["websocket"],
      auth: {
        token: "valid-token",
      },
      extraHeaders: {
        origin: "http://localhost:4200",
      },
    });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", reject);
    });
  });

  afterAll(async () => {
    client?.disconnect();
    await app?.close();
  });

  it("delivers claim-updated deterministically after room join", async () => {
    await new Promise<void>((resolve, reject) => {
      client.emit(
        "join-claim-room",
        "claim-123",
        (response: unknown) => {
          try {
            expect(response).toEqual({
              joined: "claim-123",
            });
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
    });

    const updatePromise = new Promise((resolve) => {
      client.once("claim-updated", resolve);
    });

    gateway.server.emit = gateway.server.emit.bind(gateway.server);

    gateway.handleClaimStatusChanged({
      claimId: "claim-123",
      status: ClaimStatus.APPROVED,
      updatedAt: new Date("2026-07-10T19:00:00.000Z"),
      traceId: "incoming-trace",
    });

    await expect(updatePromise).resolves.toEqual(
      expect.objectContaining({
        claimId: "claim-123",
        status: ClaimStatus.APPROVED,
      }),
    );
  });
});
