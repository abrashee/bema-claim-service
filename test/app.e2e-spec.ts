import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppController } from "../src/app.controller";
import { GlobalHttpExceptionFilter } from "../src/common/exceptions/global-http-exception.filter";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(
      new GlobalHttpExceptionFilter({
        error: jest.fn(),
      } as any),
    );
    await app.init();
  });

  it("/ (POST) returns 405", () => {
    return request(app.getHttpServer())
      .post("/")
      .expect(405);
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            service: "bema-claim-service",
            status: "running",
          }),
        );
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
