// src/common/observability/tracing.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getClaimServiceConfig } from "../config/service-config";

let sdk: NodeSDK | null = null;

export function startTracing() {
  if (sdk) {
    return;
  }

  const config = getClaimServiceConfig();

  sdk = new NodeSDK({
    serviceName: "bema-claim-service",
    traceExporter: new OTLPTraceExporter({
      url: config.otlpTraceEndpoint,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  void sdk.start();
}
