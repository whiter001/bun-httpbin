import { describe, expect, test } from "bun:test";

import { useTestServer } from "./helpers/server";

describe("inspect endpoints", () => {
  const server = useTestServer();

  test("GET /headers lower-cases and returns request headers", async () => {
    const response = await fetch(`${server.baseUrl()}/headers`, {
      headers: {
        "User-Agent": "inspect-suite",
        "X-Custom-Header": "custom",
      },
    });
    const body = (await response.json()) as Record<string, Record<string, string>>;

    expect(response.status).toBe(200);
    expect(body.headers["user-agent"]).toBe("inspect-suite");
    expect(body.headers["x-custom-header"]).toBe("custom");
  });

  test("GET /ip prefers x-forwarded-for", async () => {
    const response = await fetch(`${server.baseUrl()}/ip`, {
      headers: {
        "x-forwarded-for": "192.0.2.50, 192.0.2.51",
      },
    });
    const body = (await response.json()) as Record<string, string>;

    expect(response.status).toBe(200);
    expect(body.origin).toBe("192.0.2.50");
  });

  test("GET /user-agent returns the current user agent string", async () => {
    const response = await fetch(`${server.baseUrl()}/user-agent`, {
      headers: {
        "user-agent": "agent-check/1.0",
      },
    });
    const body = (await response.json()) as Record<string, string>;

    expect(response.status).toBe(200);
    expect(body["user-agent"]).toBe("agent-check/1.0");
  });
});
