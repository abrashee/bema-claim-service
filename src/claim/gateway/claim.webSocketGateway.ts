/**
 * LOCAL DOMAIN EVENT CONSUMER
 *
 * NOTE:
 * This is NOT a distributed event system.
 * Events are in-process only via EventEmitter2.
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { ConnectedSocket, MessageBody, WsException } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { OnEvent } from "@nestjs/event-emitter";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  CLAIM_EVENTS,
  ClaimStatusChangedEvent,
} from "../../common/events/claim.events";
import { ClaimService } from "../claims.service";
import { JwtTokenService } from "../../common/auth/jwt-token.service";
import { getClaimServiceConfig } from "../../common/config/service-config";

@WebSocketGateway({
  cors: {
    origin: getClaimServiceConfig().websocketOrigin,
    credentials: false,
  },
})
export class ClaimGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly claimService: ClaimService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const tracer = trace.getTracer("claim-websocket");

    await tracer.startActiveSpan("websocket.connect", async (span) => {
      span.setAttribute("messaging.system", "socket.io");
      span.setAttribute("messaging.operation", "connect");
      span.setAttribute("network.peer.address", client.handshake.address);

      try {
        const token = this.extractToken(client);
        const verified = await this.jwtTokenService.verifyToken(token);

        client.data.identityId = verified.userId;
        client.data.role = verified.role;
        span.setAttribute("enduser.id", verified.userId);
        span.setAttribute("enduser.role", verified.role);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "WebSocket authentication failed",
        });
        client.disconnect(true);
      } finally {
        span.end();
      }
    });
  }

  @SubscribeMessage("join-claim-room")
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() claimId: string,
  ) {
    const tracer = trace.getTracer("claim-websocket");

    return tracer.startActiveSpan("websocket.join_claim_room", async (span) => {
      span.setAttribute("messaging.system", "socket.io");
      span.setAttribute("messaging.operation", "receive");
      span.setAttribute("messaging.destination.name", "join-claim-room");
      span.setAttribute("claim.id", claimId);

      try {
        const identityId = this.getIdentityId(client);
        span.setAttribute("enduser.id", identityId);

        await this.claimService.getClaim(claimId, identityId);
        await client.join(claimId);

        span.setStatus({ code: SpanStatusCode.OK });

        return {
          joined: claimId,
        };
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Claim room authorization failed",
        });

        throw new WsException("Unauthorized");
      } finally {
        span.end();
      }
    });
  }

  @OnEvent(CLAIM_EVENTS.STATUS_CHANGED)
  handleClaimStatusChanged(payload: ClaimStatusChangedEvent) {
    const tracer = trace.getTracer("claim-websocket");

    tracer.startActiveSpan("websocket.emit_claim_updated", (span) => {
      span.setAttribute("messaging.system", "socket.io");
      span.setAttribute("messaging.operation", "publish");
      span.setAttribute("messaging.destination.name", "claim-updated");
      span.setAttribute("claim.id", payload.claimId);
      span.setAttribute("claim.status", payload.status);

      try {
        const traceId = span.spanContext().traceId;

        this.server.to(payload.claimId).emit("claim-updated", {
          claimId: payload.claimId,
          status: payload.status,
          updatedAt: payload.updatedAt,
          traceId,
        });

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Claim update delivery failed",
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    const headerToken = client.handshake.headers.authorization;
    const token = typeof authToken === "string" ? authToken : headerToken;

    if (!token) {
      throw new WsException("Missing authorization token");
    }

    if (token.startsWith("Bearer ")) {
      return token.slice(7).trim();
    }

    return token.trim();
  }

  private getIdentityId(client: Socket): string {
    const identityId = client.data.identityId;

    if (typeof identityId !== "string" || identityId.length === 0) {
      throw new WsException("Unauthorized");
    }

    return identityId;
  }
}
