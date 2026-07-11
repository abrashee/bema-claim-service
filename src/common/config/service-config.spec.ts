import {
  loadClaimServiceConfig,
  resetClaimServiceConfig,
} from "./service-config";

describe("ClaimServiceConfig CORS", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetClaimServiceConfig();
    process.env = {
      ...originalEnv,
      JWT_SECRET: "a".repeat(32),
      REDIS_HOST: "redis",
      REDIS_PORT: "6379",
      WEBSOCKET_ORIGIN: "https://app.example.test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetClaimServiceConfig();
  });

  it("uses the configured WebSocket origin", () => {
    expect(loadClaimServiceConfig().websocketOrigin)
      .toBe("https://app.example.test");
  });

  it("rejects a wildcard WebSocket origin", () => {
    process.env.WEBSOCKET_ORIGIN = "*";

    expect(() => loadClaimServiceConfig())
      .toThrow("CORS origin must not be a wildcard");
  });
});
