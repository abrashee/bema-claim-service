import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ClaimService } from "./claims.service";
import { CreateClaimDto } from "./dto/create-claim.dto";
import { ClaimAuthGuard } from "../common/auth/claim-auth.guard";
import { CurrentIdentity } from "../common/auth/current-identity.decorator";
import { Public } from "../common/auth/public.decorator";

@Controller("api/claims")
@UseGuards(ClaimAuthGuard)
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @Post()
  create(
    @CurrentIdentity() identityId: string,
    @Body() dto: CreateClaimDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.claimService.createClaim(identityId, dto, idempotencyKey);
  }

  @Get()
  async getAll(@CurrentIdentity() identityId: string) {
    const claims = await this.claimService.getAllClaims(identityId);

    return {
      data: claims,
      message: "Claims fetched successfully",
    };
  }

  @Get("actuator/health")
  @Public()
  health() {
    return {
      status: "UP",
      service: "bema-claim-service",
      timestamp: new Date().toISOString(),
    };
  }

  @Get(":id")
  get(
    @CurrentIdentity() identityId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.claimService.getClaim(id, identityId);
  }
}
