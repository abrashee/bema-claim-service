export interface ClaimServiceConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  requestBodyLimit: string;
  websocketOrigin: string;
  redisHost: string;
  redisPort: number;
  redisConnectTimeoutMs: number;
  createClaimRateLimit: number;
  createClaimRateWindowMs: number;
  queueBackpressureLimit: number;
  otlpTraceEndpoint: string;
  userServiceUrl: string;
}

let cachedConfig: ClaimServiceConfig | null = null;

function parsePositiveInt(name: string, fallback?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return value;
}

function parseOptionalInt(name: string, fallback: number): number {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return value;
}

function parseRequiredString(name: string, minimumLength?: number): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (minimumLength !== undefined && value.length < minimumLength) {
    throw new Error(
      `Environment variable ${name} must be at least ${minimumLength} characters long`,
    );
  }

  return value;
}

function parseOrigin(value: string | undefined, fallback: string): string {
  const origin = value?.trim() || fallback;

  if (origin === "*") {
    throw new Error("CORS origin must not be a wildcard");
  }

  let parsed: URL;

  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("CORS origin must be a valid HTTP or HTTPS origin");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CORS origin must use HTTP or HTTPS");
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("CORS origin must not contain credentials, a path, query, or fragment");
  }

  return parsed.origin;
}

export function loadClaimServiceConfig(): ClaimServiceConfig {
  const config: ClaimServiceConfig = {
    port: parseOptionalInt("PORT", 8083),
    nodeEnv: process.env.NODE_ENV?.trim() || "production",
    jwtSecret: parseRequiredString("JWT_SECRET", 32),
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT?.trim() || "64kb",
    websocketOrigin: parseOrigin(
      process.env.WEBSOCKET_ORIGIN,
      "http://localhost:4200",
    ),
    redisHost: parseRequiredString("REDIS_HOST"),
    redisPort: parsePositiveInt("REDIS_PORT"),
    redisConnectTimeoutMs: parseOptionalInt("REDIS_CONNECT_TIMEOUT_MS", 2000),
    createClaimRateLimit: parseOptionalInt("CLAIM_CREATE_RATE_LIMIT", 10),
    createClaimRateWindowMs: parseOptionalInt(
      "CLAIM_CREATE_RATE_WINDOW_MS",
      60_000,
    ),
    queueBackpressureLimit: parseOptionalInt(
      "CLAIM_QUEUE_BACKPRESSURE_LIMIT",
      1000,
    ),
    otlpTraceEndpoint:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() ||
      "http://localhost:4318/v1/traces",
    userServiceUrl:
      process.env.USER_SERVICE_URL?.trim() || "http://user-service:8081",
  };

  cachedConfig = config;

  return config;
}

export function getClaimServiceConfig(): ClaimServiceConfig {
  if (!cachedConfig) {
    return loadClaimServiceConfig();
  }

  return cachedConfig;
}

export function isAllowedWebSocketOrigin(
  requestOrigin: string | undefined,
): boolean {
  if (typeof requestOrigin !== "string" || requestOrigin.length === 0) {
    return false;
  }

  return requestOrigin === getClaimServiceConfig().websocketOrigin;
}

export function resetClaimServiceConfig(): void {
  cachedConfig = null;
}
