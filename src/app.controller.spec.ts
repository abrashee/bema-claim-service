// src app.controller.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("should return service status", () => {
      expect(appController.getHello()).toEqual(
        expect.objectContaining({
          service: "bema-claim-service",
          status: "running",
        }),
      );
    });
  });
});
