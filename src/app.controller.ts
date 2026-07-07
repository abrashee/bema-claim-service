// src app.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      service: "bema-claim-service",
      status: "running",
      timestamp: new Date().toISOString(),
    };
  }
}
