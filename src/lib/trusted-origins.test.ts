import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  alignForwardedHostForTrustedOrigin,
  getTrustedActionOrigins,
  hostFromUrl,
} from "@/lib/trusted-origins";

describe("trusted-origins", () => {
  const envKeys = [
    "AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "SERVER_ACTIONS_ALLOWED_ORIGINS",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("parses hosts from URLs", () => {
    expect(hostFromUrl("https://App.Example.com/path")).toBe("app.example.com");
    expect(hostFromUrl("not-a-url")).toBeNull();
  });

  it("collects trusted origins from env only", () => {
    process.env.AUTH_URL = "https://app.example.com";
    process.env.SERVER_ACTIONS_ALLOWED_ORIGINS =
      "platform.example-paas.com, Preview.Example.com";
    expect(getTrustedActionOrigins()).toEqual([
      "app.example.com",
      "platform.example-paas.com",
      "preview.example.com",
    ]);
  });

  it("aligns x-forwarded-host for trusted public origins", () => {
    process.env.AUTH_URL = "https://app.example.com";
    const headers = new Headers({
      origin: "https://app.example.com",
      "x-forwarded-host": "platform.example-paas.com",
    });
    const next = alignForwardedHostForTrustedOrigin(headers);
    expect(next?.get("x-forwarded-host")).toBe("app.example.com");
  });

  it("does not rewrite untrusted origins", () => {
    process.env.AUTH_URL = "https://app.example.com";
    const headers = new Headers({
      origin: "https://evil.example",
      "x-forwarded-host": "platform.example-paas.com",
    });
    expect(alignForwardedHostForTrustedOrigin(headers)).toBeNull();
  });
});
