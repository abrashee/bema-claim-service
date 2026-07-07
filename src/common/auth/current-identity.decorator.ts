import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedClaimRequest } from "./claim-auth.guard";

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedClaimRequest>();
    return request.identityId ?? "";
  },
);
