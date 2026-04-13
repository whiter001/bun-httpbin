import { describe, expect, test } from "bun:test";

import { useTestServer } from "./helpers/server";

describe("remaining httpbin endpoints", () => {
  const server = useTestServer();

  test("GET /status/418 returns the requested status and empty body", async () => {
    const response = await fetch(`${server.baseUrl()}/status/418`);

    expect(response.status).toBe(418);
    expect(await response.text()).toBe("");
  });

  test("GET /redirect/2 returns a redirect chain", async () => {
    const response = await fetch(`${server.baseUrl()}/redirect/2`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/redirect/1");
  });

  test("GET /relative-redirect/2 returns a relative location", async () => {
    const response = await fetch(`${server.baseUrl()}/relative-redirect/2`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("../relative-redirect/1");
  });

  test("GET /absolute-redirect/2 returns an absolute location", async () => {
    const response = await fetch(`${server.baseUrl()}/absolute-redirect/2`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/absolute-redirect/1");
  });

  test("GET /cookies/set sets cookies and redirects to /cookies", async () => {
    const response = await fetch(`${server.baseUrl()}/cookies/set?flavor=chocolate&size=large`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/cookies");
    expect(getSetCookie(response.headers)).toEqual(
      expect.arrayContaining(["flavor=chocolate; Path=/", "size=large; Path=/"]),
    );

    const cookiesResponse = await fetch(`${server.baseUrl()}/cookies`, {
      headers: {
        cookie: "flavor=chocolate; size=large",
      },
    });
    const body = (await cookiesResponse.json()) as Record<string, Record<string, string>>;

    expect(body.cookies).toEqual({
      flavor: "chocolate",
      size: "large",
    });
  });

  test("GET /cookies/delete clears cookies and redirects to /cookies", async () => {
    const response = await fetch(`${server.baseUrl()}/cookies/delete?flavor=chocolate`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/cookies");
    expect(getSetCookie(response.headers)[0]).toContain("Max-Age=0");
  });

  test("basic auth succeeds and fails as expected", async () => {
    const success = await fetch(`${server.baseUrl()}/basic-auth/alice/secret`, {
      headers: {
        authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
      },
    });
    const successBody = (await success.json()) as Record<string, unknown>;

    expect(success.status).toBe(200);
    expect(successBody).toEqual({
      authenticated: true,
      user: "alice",
    });

    const failure = await fetch(`${server.baseUrl()}/basic-auth/alice/secret`);

    expect(failure.status).toBe(401);
    expect(failure.headers.get("www-authenticate")).toBe('Basic realm="Fake Realm"');
  });

  test("bearer auth succeeds and fails as expected", async () => {
    const success = await fetch(`${server.baseUrl()}/bearer`, {
      headers: {
        authorization: "Bearer sample-token",
      },
    });
    const successBody = (await success.json()) as Record<string, unknown>;

    expect(success.status).toBe(200);
    expect(successBody).toEqual({
      authenticated: true,
      token: "sample-token",
    });

    const failure = await fetch(`${server.baseUrl()}/bearer`);

    expect(failure.status).toBe(401);
    expect(failure.headers.get("www-authenticate")).toBe("Bearer");
  });

  test("GET /uuid returns a uuid", async () => {
    const response = await fetch(`${server.baseUrl()}/uuid`);
    const body = (await response.json()) as Record<string, string>;

    expect(response.status).toBe(200);
    expect(body.uuid).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test("GET /base64 decodes the path value", async () => {
    const response = await fetch(
      `${server.baseUrl()}/base64/${encodeURIComponent("SGVsbG8gQnVuIQ==")}`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello Bun!");
  });

  test("GET /bytes/8 returns eight random bytes", async () => {
    const response = await fetch(`${server.baseUrl()}/bytes/8`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/octet-stream");
    expect((await response.arrayBuffer()).byteLength).toBe(8);
  });

  test("GET /delay/1 returns the echo payload after a delay", async () => {
    const startedAt = performance.now();
    const response = await fetch(`${server.baseUrl()}/delay/1`);
    const elapsed = performance.now() - startedAt;
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(body.url).toContain("/delay/1");
  });

  test("GET /stream/3 returns NDJSON lines", async () => {
    const response = await fetch(`${server.baseUrl()}/stream/3`);
    const lines = (await response.text())
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(lines).toHaveLength(3);
    expect(lines[0].id).toBe(0);
    expect(lines[2].id).toBe(2);
    expect(lines[1].url).toContain("/stream/3");
  });

  test("GET /json returns the slideshow payload", async () => {
    const response = await fetch(`${server.baseUrl()}/json`);
    const body = (await response.json()) as { slideshow: { title: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.slideshow.title).toBe("Sample Slide Show");
  });

  test("GET /xml returns the slideshow xml", async () => {
    const response = await fetch(`${server.baseUrl()}/xml`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(body.startsWith("<?xml")).toBe(true);
    expect(body).toContain("<slideshow");
  });

  test("GET /robots.txt returns robots instructions", async () => {
    const response = await fetch(`${server.baseUrl()}/robots.txt`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /deny");
  });

  test("GET /deny returns a 403 text response", async () => {
    const response = await fetch(`${server.baseUrl()}/deny`);
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("Access denied");
  });

  test("GET /gzip, /deflate and /brotli return compressed json", async () => {
    const routeExpectations = [
      ["gzip", "gzipped", "gzip"],
      ["deflate", "deflated", "deflate"],
      ["brotli", "brotli", "br"],
    ] as const;

    for (const [route, fieldName, encoding] of routeExpectations) {
      const response = await fetch(`${server.baseUrl()}/${route}`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(response.headers.get("content-encoding")).toBe(encoding);
      expect(body[fieldName]).toBe(true);
      expect(body.url).toContain(`/${route}`);
    }
  });
});

function getSetCookie(headers: Headers): string[] {
  const typedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  return typedHeaders.getSetCookie?.() ?? [];
}
