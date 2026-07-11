import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { JwtTokenService } from "./jwt-token.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

export interface AuthenticatedClaimRequest extends Request {
  identityId?: string;
}

@Injectable()
export class ClaimAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedClaimRequest>();
    const authorization = request.headers.authorization;
    const verifiedToken = await this.jwtTokenService.verifyBearerToken(authorization);

    if (!verifiedToken.userId) {
      throw new UnauthorizedException("Invalid authorization token");
    }

    request.identityId = verifiedToken.userId;

    return true;
  }
}
