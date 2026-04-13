import { afterAll, beforeAll } from "bun:test";

import { createFetchHandler } from "../../src/app";

const testServerOptions = {
  fetch: createFetchHandler(),
  hostname: "127.0.0.1",
  port: 0,
} as Bun.Serve.Options<undefined>;

export function useTestServer() {
  let server: Bun.Server<undefined>;
  let baseUrl = "";

  beforeAll(() => {
    server = Bun.serve(testServerOptions);
    baseUrl = `http://${server.hostname}:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  return {
    baseUrl: () => baseUrl,
  };
}
