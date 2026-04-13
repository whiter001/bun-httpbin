import { describe, expect, test } from "bun:test";

import { useTestServer } from "./helpers/server";

describe("echo endpoints", () => {
  const server = useTestServer();

  test("GET /get returns query args and request metadata", async () => {
    const response = await fetch(`${server.baseUrl()}/get?hello=world&hello=bun&lang=ts`, {
      headers: {
        "user-agent": "bun-test-suite",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.args).toEqual({
      hello: ["world", "bun"],
      lang: "ts",
    });
    expect(body.origin).toBe("203.0.113.10");
    expect((body.headers as Record<string, string>)["user-agent"]).toBe("bun-test-suite");
    expect(body.url).toBe(`${server.baseUrl()}/get?hello=world&hello=bun&lang=ts`);
  });

  test("POST /post echoes JSON bodies", async () => {
    const payload = {
      ok: true,
      runtime: "bun",
    };
    const response = await fetch(`${server.baseUrl()}/post?debug=1`, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.8",
      },
      method: "POST",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.method).toBe("POST");
    expect(body.args).toEqual({ debug: "1" });
    expect(body.json).toEqual(payload);
    expect(body.data).toBe(JSON.stringify(payload));
    expect(body.origin).toBe("198.51.100.8");
  });

  test("PUT /put parses urlencoded forms", async () => {
    const response = await fetch(`${server.baseUrl()}/put`, {
      body: new URLSearchParams({
        feature: "echo",
        runtime: "bun",
      }),
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "PUT",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.form).toEqual({
      feature: "echo",
      runtime: "bun",
    });
    expect(body.files).toEqual({});
    expect(body.data).toBe("");
  });

  test("PATCH /patch echoes plain text bodies", async () => {
    const response = await fetch(`${server.baseUrl()}/patch`, {
      body: "hello from bun",
      headers: {
        "content-type": "text/plain",
      },
      method: "PATCH",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.data).toBe("hello from bun");
    expect(body.json).toBeNull();
    expect(body.method).toBe("PATCH");
  });

  test("DELETE /delete captures multipart fields and file metadata", async () => {
    const form = new FormData();
    form.set("topic", "upload");
    form.set("attachment", new File(["hello bun"], "hello.txt", { type: "text/plain" }));

    const response = await fetch(`${server.baseUrl()}/delete`, {
      body: form,
      method: "DELETE",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.form).toEqual({ topic: "upload" });
    expect(body.files).toEqual({
      attachment: {
        name: "hello.txt",
        size: 9,
        type: "text/plain",
      },
    });
  });
});
