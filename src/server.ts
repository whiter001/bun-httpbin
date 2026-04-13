import { createFetchHandler } from "./app";

const hostname = Bun.env.HOST ?? "127.0.0.1";
const port = Number(Bun.env.PORT ?? 3000);

const serverOptions = {
  fetch: createFetchHandler(),
  hostname,
  port,
} as Bun.Serve.Options<undefined>;

export function startServer(): Bun.Server<undefined> {
  return Bun.serve(serverOptions);
}

if (import.meta.main) {
  const server = startServer();
  console.log(`bun-httpbin listening on http://${server.hostname}:${server.port}`);
}
