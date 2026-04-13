import { describe, expect, test } from "bun:test";

import { useTestServer } from "./helpers/server";

describe("error handling", () => {
  const server = useTestServer();

  test("unknown routes return 404", async () => {
    const response = await fetch(`${server.baseUrl()}/missing`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: "Not Found",
      status: 404,
    });
  });

  test("known routes reject unsupported methods", async () => {
    const response = await fetch(`${server.baseUrl()}/post`, {
      method: "GET",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(405);
    expect(body).toEqual({
      error: "Method Not Allowed",
      status: 405,
    });
  });

  test("invalid JSON payloads return 400", async () => {
    const response = await fetch(`${server.baseUrl()}/post`, {
      body: '{"broken":',
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: "Invalid JSON body",
      status: 400,
    });
  });
});
