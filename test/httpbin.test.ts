import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'

import { useTestServer } from './helpers/server'

describe('remaining httpbin endpoints', () => {
  const server = useTestServer()

  test('GET /status/418 returns the requested status and empty body', async () => {
    const response = await fetch(`${server.baseUrl()}/status/418`)
    const body = await response.text()

    expect(response.status).toBe(418)
    expect(response.headers.get('x-more-info')).toBe(
      'http://tools.ietf.org/html/rfc2324'
    )
    expect(body).toContain('teapot')
  })

  test('GET / returns the landing page', async () => {
    const response = await fetch(`${server.baseUrl()}/`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('httpbin')
  })

  test('GET /anything echoes the request method and nested path', async () => {
    const response = await fetch(
      `${server.baseUrl()}/anything/foo/bar?hello=world&hello=bun`
    )
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.method).toBe('GET')
    expect(body.url).toBe(
      `${server.baseUrl()}/anything/foo/bar?hello=world&hello=bun`
    )
    expect(body.args).toEqual({ hello: ['world', 'bun'] })
  })

  test('GET /response-headers returns echoed response headers', async () => {
    const response = await fetch(
      `${server.baseUrl()}/response-headers?animal=dog&animal=cat`
    )
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.animal).toEqual(['dog', 'cat'])
    expect(response.headers.get('animal')).toContain('dog')
  })

  test('GET /cache returns 304 for conditional requests', async () => {
    const response = await fetch(`${server.baseUrl()}/cache`, {
      headers: {
        'if-none-match': 'demo'
      }
    })

    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
  })

  test('GET /cache returns a cached payload when no validators are sent', async () => {
    const response = await fetch(`${server.baseUrl()}/cache`)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('cache')
    expect(response.headers.get('last-modified')).toContain('GMT')
    expect(body.url).toBe(`${server.baseUrl()}/cache`)
  })

  test('GET /redirect/5?absolute=true redirects absolutely', async () => {
    const response = await fetch(
      `${server.baseUrl()}/redirect/5?absolute=true`,
      {
        redirect: 'manual'
      }
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      `${server.baseUrl()}/absolute-redirect/4`
    )
  })

  test('GET /etag respects conditional headers', async () => {
    const response = await fetch(`${server.baseUrl()}/etag/demo`, {
      headers: {
        'if-none-match': 'W/"demo"'
      }
    })

    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe('demo')
  })

  test('GET /etag/demo rejects non-matching If-Match headers', async () => {
    const response = await fetch(`${server.baseUrl()}/etag/demo`, {
      headers: {
        'if-match': 'W/"other"'
      }
    })

    expect(response.status).toBe(412)
    expect(await response.text()).toBe('')
  })

  test('GET /cookies/set/name/value sets a cookie and redirects', async () => {
    const response = await fetch(
      `${server.baseUrl()}/cookies/set/flavor/chocolate`,
      {
        redirect: 'manual'
      }
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/cookies')
    expect(getSetCookie(response.headers)[0]).toContain('flavor=chocolate')
  })

  test('GET /links/n redirects and renders a link page', async () => {
    const redirectResponse = await fetch(`${server.baseUrl()}/links/3`, {
      redirect: 'manual'
    })
    const pageResponse = await fetch(`${server.baseUrl()}/links/3/1`)
    const pageBody = await pageResponse.text()

    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.get('location')).toBe('/links/3/0')
    expect(pageResponse.status).toBe(200)
    expect(pageBody).toContain('<title>Links</title>')
    expect(pageBody).toContain('/links/3/0')
  })

  test('GET /drip returns the requested byte count', async () => {
    const response = await fetch(
      `${server.baseUrl()}/drip?numbytes=5&duration=1&delay=0`
    )
    const body = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('5')
    expect(body).toHaveLength(5)
  })

  test('digest auth returns 200 with a valid digest response', async () => {
    const uri = '/digest-auth/auth/alice/secret/MD5/never'
    const challengeResponse = await fetch(`${server.baseUrl()}${uri}`, {
      redirect: 'manual'
    })
    const challenge = challengeResponse.headers.get('www-authenticate') ?? ''
    const challengeParts = parseDigestChallenge(challenge)
    const nonce = challengeParts.nonce
    const realm = challengeParts.realm
    const opaque = challengeParts.opaque
    const algorithm = challengeParts.algorithm ?? 'MD5'
    const qop =
      challengeParts.qop
        ?.split(',')
        .map((item) => item.trim())
        .find((item) => item === 'auth') ?? 'auth'
    const authHeader = buildDigestAuthHeader({
      algorithm,
      cnonce: '0123456789abcdef',
      method: 'GET',
      nonce,
      nc: '00000001',
      opaque,
      password: 'secret',
      qop,
      realm,
      uri,
      username: 'alice'
    })

    const authorizedResponse = await fetch(`${server.baseUrl()}${uri}`, {
      headers: {
        authorization: authHeader
      }
    })
    const body = (await authorizedResponse.json()) as Record<string, unknown>

    expect(challengeResponse.status).toBe(401)
    expect(challengeParts.qop).toContain('auth')
    expect(authorizedResponse.status).toBe(200)
    expect(body).toEqual({ authenticated: true, user: 'alice' })
  })

  test('GET /redirect-to redirects to the provided URL', async () => {
    const response = await fetch(
      `${server.baseUrl()}/redirect-to?url=/post&status_code=307`,
      {
        redirect: 'manual'
      }
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/post')
  })

  test('GET /range and /stream-bytes return binary data with the expected length', async () => {
    const rangeResponse = await fetch(`${server.baseUrl()}/range/26`, {
      headers: {
        Range: 'bytes=20-'
      }
    })
    const rangeBody = new Uint8Array(await rangeResponse.arrayBuffer())

    expect(rangeResponse.status).toBe(206)
    expect(rangeResponse.headers.get('content-range')).toBe('bytes 20-25/26')
    expect(Buffer.from(rangeBody).toString('utf8')).toBe('uvwxyz')

    const streamOne = await fetch(`${server.baseUrl()}/stream-bytes/10?seed=0`)
    const streamTwo = await fetch(`${server.baseUrl()}/stream-bytes/10?seed=0`)
    const firstBytes = new Uint8Array(await streamOne.arrayBuffer())
    const secondBytes = new Uint8Array(await streamTwo.arrayBuffer())

    expect(streamOne.status).toBe(200)
    expect(firstBytes).toHaveLength(10)
    expect(secondBytes).toEqual(firstBytes)
  })

  test('GET /range/26 rejects unsatisfiable ranges', async () => {
    const response = await fetch(`${server.baseUrl()}/range/26`, {
      headers: {
        Range: 'bytes=999-1000'
      }
    })

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */26')
  })

  test('GET /hidden-basic-auth hides unauthorized requests', async () => {
    const denied = await fetch(
      `${server.baseUrl()}/hidden-basic-auth/alice/secret`
    )
    expect(denied.status).toBe(404)

    const allowed = await fetch(
      `${server.baseUrl()}/hidden-basic-auth/alice/secret`,
      {
        headers: {
          authorization: `Basic ${Buffer.from('alice:secret').toString('base64')}`
        }
      }
    )
    const allowedBody = (await allowed.json()) as Record<string, unknown>

    expect(allowed.status).toBe(200)
    expect(allowedBody).toEqual({ authenticated: true, user: 'alice' })
  })

  test('GET /image and /encoding/utf8 return compatibility pages', async () => {
    const imageResponse = await fetch(`${server.baseUrl()}/image`, {
      headers: {
        accept: 'image/svg+xml'
      }
    })
    const imageBody = await imageResponse.text()

    expect(imageResponse.status).toBe(200)
    expect(imageResponse.headers.get('content-type')).toContain('image/svg+xml')
    expect(imageBody).toContain('<svg')

    const utf8Response = await fetch(`${server.baseUrl()}/encoding/utf8`)
    const utf8Body = await utf8Response.text()

    expect(utf8Response.status).toBe(200)
    expect(utf8Body).toContain('你好')
  })

  test('GET /image rejects unsupported accept headers', async () => {
    const response = await fetch(`${server.baseUrl()}/image`, {
      headers: {
        accept: 'application/json'
      }
    })
    const body = (await response.json()) as {
      accept: string[]
      message: string
    }

    expect(response.status).toBe(406)
    expect(body.message).toContain('supported media type')
    expect(body.accept).toEqual(
      expect.arrayContaining(['image/png', 'image/jpeg', 'image/svg+xml'])
    )
  })

  test('GET /redirect/2 returns a redirect chain', async () => {
    const response = await fetch(`${server.baseUrl()}/redirect/2`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/redirect/1')
  })

  test('GET /relative-redirect/2 returns a relative location', async () => {
    const response = await fetch(`${server.baseUrl()}/relative-redirect/2`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('../relative-redirect/1')
  })

  test('GET /absolute-redirect/2 returns an absolute location', async () => {
    const response = await fetch(`${server.baseUrl()}/absolute-redirect/2`, {
      redirect: 'manual'
    })

    expect(response.status).toBe(302)
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
      '/absolute-redirect/1'
    )
  })

  test('GET /cookies/set sets cookies and redirects to /cookies', async () => {
    const response = await fetch(
      `${server.baseUrl()}/cookies/set?flavor=chocolate&size=large`,
      {
        redirect: 'manual'
      }
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/cookies')
    expect(getSetCookie(response.headers)).toEqual(
      expect.arrayContaining(['flavor=chocolate; Path=/', 'size=large; Path=/'])
    )

    const cookiesResponse = await fetch(`${server.baseUrl()}/cookies`, {
      headers: {
        cookie: 'flavor=chocolate; size=large'
      }
    })
    const body = (await cookiesResponse.json()) as Record<
      string,
      Record<string, string>
    >

    expect(body.cookies).toEqual({
      flavor: 'chocolate',
      size: 'large'
    })
  })

  test('GET /cookies/delete clears cookies and redirects to /cookies', async () => {
    const response = await fetch(
      `${server.baseUrl()}/cookies/delete?flavor=chocolate`,
      {
        redirect: 'manual'
      }
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/cookies')
    expect(getSetCookie(response.headers)[0]).toContain('Max-Age=0')
  })

  test('basic auth succeeds and fails as expected', async () => {
    const success = await fetch(`${server.baseUrl()}/basic-auth/alice/secret`, {
      headers: {
        authorization: `Basic ${Buffer.from('alice:secret').toString('base64')}`
      }
    })
    const successBody = (await success.json()) as Record<string, unknown>

    expect(success.status).toBe(200)
    expect(successBody).toEqual({
      authenticated: true,
      user: 'alice'
    })

    const failure = await fetch(`${server.baseUrl()}/basic-auth/alice/secret`)

    expect(failure.status).toBe(401)
    expect(failure.headers.get('www-authenticate')).toBe(
      'Basic realm="Fake Realm"'
    )
  })

  test('bearer auth succeeds and fails as expected', async () => {
    const success = await fetch(`${server.baseUrl()}/bearer`, {
      headers: {
        authorization: 'Bearer sample-token'
      }
    })
    const successBody = (await success.json()) as Record<string, unknown>

    expect(success.status).toBe(200)
    expect(successBody).toEqual({
      authenticated: true,
      token: 'sample-token'
    })

    const failure = await fetch(`${server.baseUrl()}/bearer`)

    expect(failure.status).toBe(401)
    expect(failure.headers.get('www-authenticate')).toBe('Bearer')
  })

  test('GET /uuid returns a uuid', async () => {
    const response = await fetch(`${server.baseUrl()}/uuid`)
    const body = (await response.json()) as Record<string, string>

    expect(response.status).toBe(200)
    expect(body.uuid).toMatch(/^[0-9a-f-]{36}$/i)
  })

  test('GET /base64 decodes the path value', async () => {
    const response = await fetch(
      `${server.baseUrl()}/base64/${encodeURIComponent('SGVsbG8gQnVuIQ==')}`
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Hello Bun!')
  })

  test('GET /bytes/8 returns eight random bytes', async () => {
    const response = await fetch(`${server.baseUrl()}/bytes/8`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(
      'application/octet-stream'
    )
    expect((await response.arrayBuffer()).byteLength).toBe(8)
  })

  test('GET /delay/1 returns the echo payload after a delay', async () => {
    const startedAt = performance.now()
    const response = await fetch(`${server.baseUrl()}/delay/1`)
    const elapsed = performance.now() - startedAt
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(elapsed).toBeGreaterThanOrEqual(900)
    expect(body.url).toContain('/delay/1')
  })

  test('GET /status/foo returns 400 for invalid status codes', async () => {
    const response = await fetch(`${server.baseUrl()}/status/foo`)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(400)
    expect(body).toEqual({
      error: 'Invalid status code',
      status: 400
    })
  })

  test('GET /stream/3 returns NDJSON lines', async () => {
    const response = await fetch(`${server.baseUrl()}/stream/3`)
    const lines = (await response.text())
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson'
    )
    expect(lines).toHaveLength(3)
    expect(lines[0].id).toBe(0)
    expect(lines[2].id).toBe(2)
    expect(lines[1].url).toContain('/stream/3')
  })

  test('GET /json returns the slideshow payload', async () => {
    const response = await fetch(`${server.baseUrl()}/json`)
    const body = (await response.json()) as { slideshow: { title: string } }

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(body.slideshow.title).toBe('Sample Slide Show')
  })

  test('GET /xml returns the slideshow xml', async () => {
    const response = await fetch(`${server.baseUrl()}/xml`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(body.startsWith('<?xml')).toBe(true)
    expect(body).toContain('<slideshow')
  })

  test('GET /robots.txt returns robots instructions', async () => {
    const response = await fetch(`${server.baseUrl()}/robots.txt`)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Disallow: /deny')
  })

  test('GET /deny returns a 403 text response', async () => {
    const response = await fetch(`${server.baseUrl()}/deny`)
    const body = await response.text()

    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(body).toContain('Access denied')
  })

  test('GET /gzip, /deflate and /brotli return compressed json', async () => {
    const routeExpectations = [
      ['gzip', 'gzipped', 'gzip'],
      ['deflate', 'deflated', 'deflate'],
      ['brotli', 'brotli', 'br']
    ] as const

    for (const [route, fieldName, encoding] of routeExpectations) {
      const response = await fetch(`${server.baseUrl()}/${route}`)
      const body = (await response.json()) as Record<string, unknown>

      expect(response.status).toBe(200)
      expect(response.headers.get('content-encoding')).toBe(encoding)
      expect(body[fieldName]).toBe(true)
      expect(body.url).toContain(`/${route}`)
    }
  })
})

function getSetCookie(headers: Headers): string[] {
  const typedHeaders = headers as Headers & { getSetCookie?: () => string[] }
  return typedHeaders.getSetCookie?.() ?? []
}

function parseDigestChallenge(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  const pattern = /([a-zA-Z][\w-]*)="([^"]*)"/g

  for (
    let match = pattern.exec(header);
    match !== null;
    match = pattern.exec(header)
  ) {
    result[match[1].toLowerCase()] = match[2]
  }

  return result
}

function buildDigestAuthHeader(params: {
  algorithm: string
  cnonce: string
  method: string
  nonce: string
  nc: string
  opaque: string
  password: string
  qop: string
  realm: string
  uri: string
  username: string
}): string {
  const {
    algorithm,
    cnonce,
    method,
    nonce,
    nc,
    opaque,
    password,
    qop,
    realm,
    uri,
    username
  } = params
  const ha1 = hashDigest(`${username}:${realm}:${password}`, algorithm)
  const ha2 = hashDigest(`${method}:${uri}`, algorithm)
  const response = hashDigest(
    `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`,
    algorithm
  )

  return [
    'Digest username="' + username + '"',
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    `opaque="${opaque}"`,
    `algorithm="${algorithm}"`,
    `qop=${qop}`,
    `nc=${nc}`,
    `cnonce="${cnonce}"`
  ].join(', ')
}

function hashDigest(value: string, algorithm: string): string {
  const nodeAlgorithm =
    algorithm === 'SHA-256'
      ? 'sha256'
      : algorithm === 'SHA-512'
        ? 'sha512'
        : 'md5'

  return createHash(nodeAlgorithm).update(value).digest('hex')
}
