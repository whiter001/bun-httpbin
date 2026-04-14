import { createServerOptions } from './app'

const serverOptions = createServerOptions()

export function startServer(): Bun.Server<undefined> {
  return Bun.serve(serverOptions)
}

if (import.meta.main) {
  const server = startServer()
  console.log(`bun-httpbin listening on http://${server.hostname}:${server.port}`)
}
