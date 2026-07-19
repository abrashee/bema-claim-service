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

  if (!config.otelEnabled) {
    return;
  }

  if (!config.otlpTraceEndpoint) {
    throw new Error(
      "ENABLE_OTEL=true requires OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
    );
  }

  sdk = new NodeSDK({
    serviceName: "bema-claim-service",
    traceExporter: new OTLPTraceExporter({
      url: config.otlpTraceEndpoint,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  void sdk.start();
}
