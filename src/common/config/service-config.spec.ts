import {
  isAllowedWebSocketOrigin,
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

  it("normalizes a configured origin", () => {
    process.env.WEBSOCKET_ORIGIN = "https://app.example.test/";

    expect(loadClaimServiceConfig().websocketOrigin)
      .toBe("https://app.example.test");
  });

  it.each([
    "not-a-url",
    "ftp://app.example.test",
    "https://user:password@app.example.test",
    "https://app.example.test/path",
    "https://app.example.test?query=true",
    "https://app.example.test#fragment",
  ])("rejects an invalid WebSocket origin: %s", (origin) => {
    process.env.WEBSOCKET_ORIGIN = origin;

    expect(() => loadClaimServiceConfig()).toThrow();
  });

  it("accepts only the configured WebSocket request origin", () => {
    loadClaimServiceConfig();

    expect(
      isAllowedWebSocketOrigin("https://app.example.test"),
    ).toBe(true);

    expect(
      isAllowedWebSocketOrigin("https://attacker.example.test"),
    ).toBe(false);

    expect(isAllowedWebSocketOrigin(undefined)).toBe(false);
    expect(isAllowedWebSocketOrigin("")).toBe(false);
  });
});
