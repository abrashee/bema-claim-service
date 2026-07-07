// src/common/observability/http-metrics.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { MetricsService } from "./metrics.service";

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.includes("/actuator")) return next();

    res.on("finish", () => {
      this.metrics.httpRequestsTotal.inc({
        method: req.method,
        route: req.route?.path
          ? req.baseUrl + req.route.path
          : req.baseUrl + req.path,
        status: res.statusCode.toString(),
      });
    });

    next();
  }
}
