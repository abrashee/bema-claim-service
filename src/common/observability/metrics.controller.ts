// src/common/observability/metrics.controller.ts
import { Controller, Get, Header } from "@nestjs/common";
import { MetricsService } from "./metrics.service";

@Controller("actuator")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get("prometheus")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  async metrics() {
    return this.metricsService.getMetrics();
  }

  @Get("health")
  health() {
    return {
      status: "UP",
      service: "bema-claim-service",
      timestamp: new Date().toISOString(),
    };
  }
}
