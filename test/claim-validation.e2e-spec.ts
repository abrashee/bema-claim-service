import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { ClaimController } from "../src/claim/claim.controller";
import { ClaimService } from "../src/claim/claims.service";
import {
  AuthenticatedClaimRequest,
  ClaimAuthGuard,
} from "../src/common/auth/claim-auth.guard";
import { GlobalHttpExceptionFilter } from "../src/common/exceptions/global-http-exception.filter";

describe("Claim input validation (e2e)", () => {
  let app: INestApplication;
  let claimService: {
    createClaim: jest.Mock;
    getAllClaims: jest.Mock;
    getClaim: jest.Mock;
  };

  beforeEach(async () => {
    claimService = {
      createClaim: jest.fn(),
      getAllClaims: jest.fn(),
      getClaim: jest.fn(),
    };

    const authGuard = {
      canActivate(context: ExecutionContext): boolean {
        const authenticatedRequest = context
          .switchToHttp()
          .getRequest<AuthenticatedClaimRequest>();

        authenticatedRequest.identityId = "user-1";
        authenticatedRequest.role = "USER";

        return true;
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ClaimController],
      providers: [
        {
          provide: ClaimService,
          useValue: claimService,
        },
      ],
    })
      .overrideGuard(ClaimAuthGuard)
      .useValue(authGuard)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(
      new GlobalHttpExceptionFilter({
        error: jest.fn(),
      } as any),
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("rejects a description shorter than 10 characters", async () => {
    await request(app.getHttpServer())
      .post("/api/claims")
      .send({
        description: "short",
      })
      .expect(400);

    expect(claimService.createClaim).not.toHaveBeenCalled();
  });

  it("rejects a non-positive amount", async () => {
    await request(app.getHttpServer())
      .post("/api/claims")
      .send({
        description: "A valid claim description",
        amount: 0,
      })
      .expect(400);

    expect(claimService.createClaim).not.toHaveBeenCalled();
  });

  it("rejects an amount with more than two decimal places", async () => {
    await request(app.getHttpServer())
      .post("/api/claims")
      .send({
        description: "A valid claim description",
        amount: 10.123,
      })
      .expect(400);

    expect(claimService.createClaim).not.toHaveBeenCalled();
  });

  it("rejects unknown request fields", async () => {
    await request(app.getHttpServer())
      .post("/api/claims")
      .send({
        description: "A valid claim description",
        approved: true,
      })
      .expect(400);

    expect(claimService.createClaim).not.toHaveBeenCalled();
  });

  it("rejects an invalid claim UUID path parameter", async () => {
    await request(app.getHttpServer())
      .get("/api/claims/not-a-uuid")
      .expect(400);

    expect(claimService.getClaim).not.toHaveBeenCalled();
  });
});
