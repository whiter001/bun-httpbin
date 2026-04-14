import { afterAll, beforeAll } from 'bun:test'

import { createServerOptions } from '../../src/app'

const testServerOptions = createServerOptions({
  hostname: '127.0.0.1',
  port: 0
})

export function useTestServer() {
  let server: Bun.Server<undefined>
  let baseUrl = ''

  beforeAll(() => {
    server = Bun.serve(testServerOptions)
    baseUrl = `http://${server.hostname}:${server.port}`
  })

  afterAll(() => {
    server.stop(true)
  })

  return {
    baseUrl: () => baseUrl
  }
}
