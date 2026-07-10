// src/common/observability/metrics.service.ts
import { Injectable } from "@nestjs/common";
import * as client from "prom-client";

@Injectable()
export class MetricsService {
  public readonly registry = new client.Registry();

  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly claimFailuresTotal: client.Counter<string>;
  public readonly claimProcessingDuration: client.Histogram<string>;
  public readonly claimsCreatedTotal: client.Counter<string>;
  public readonly claimStatusTransitionsTotal: client.Counter<string>;

  constructor() {
    client.collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new client.Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });

    this.claimFailuresTotal = new client.Counter({
      name: "claim_failures_total",
      help: "Total failed claims",
      labelNames: ["stage"],
      registers: [this.registry],
    });

    this.claimProcessingDuration = new client.Histogram({
      name: "claim_processing_duration_ms",
      help: "Time taken to process claims",
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });

    this.claimsCreatedTotal = new client.Counter({
      name: "claims_created_total",
      help: "Total claims successfully created",
      registers: [this.registry],
    });

    this.claimStatusTransitionsTotal = new client.Counter({
      name: "claim_status_transitions_total",
      help: "Total successful claim status transitions",
      labelNames: ["from", "to"],
      registers: [this.registry],
    });
  }

  async getMetrics() {
    return this.registry.metrics();
  }

  getContentType() {
    return this.registry.contentType;
  }
}
