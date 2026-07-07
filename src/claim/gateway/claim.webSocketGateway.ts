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

  handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const verified = this.jwtTokenService.verifyToken(token);

      client.data.identityId = verified.userId;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join-claim-room")
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() claimId: string,
  ) {
    try {
      const identityId = this.getIdentityId(client);
      await this.claimService.getClaim(claimId, identityId);
      client.join(claimId);

      return {
        joined: claimId,
      };
    } catch {
      throw new WsException("Unauthorized");
    }
  }

  @OnEvent(CLAIM_EVENTS.STATUS_CHANGED)
  handleClaimStatusChanged(payload: ClaimStatusChangedEvent) {
    this.server.to(payload.claimId).emit("claim-updated", {
      claimId: payload.claimId,
      status: payload.status,
      updatedAt: payload.updatedAt,
      traceId: payload.traceId,
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
