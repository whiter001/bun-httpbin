import { createHash } from 'node:crypto'
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'

import type { KeyValueMap, RequestContext } from '../http/request-context'
import { buildEchoPayload } from './echo'
import {
  binaryResponse,
  errorResponse,
  jsonResponse,
  redirectResponse,
  textResponse
} from '../http/response'

const SLIDESHOW_JSON = {
  slideshow: {
    author: 'Yours Truly',
    date: 'date of publication',
    slides: [
      {
        title: 'Wake up to WonderWidgets!',
        type: 'all'
      },
      {
        items: [
          'Why <em>WonderWidgets</em> are great',
          'Who <em>buys</em> WonderWidgets'
        ],
        title: 'Overview',
        type: 'all'
      }
    ],
    title: 'Sample Slide Show'
  }
}

const SLIDESHOW_XML = `<?xml version="1.0" encoding="us-ascii"?>
<slideshow title="Sample Slide Show" date="date of publication" author="Yours Truly">
  <slide type="all">
    <title>Wake up to WonderWidgets!</title>
  </slide>
  <slide type="all">
    <title>Overview</title>
    <item>Why WonderWidgets are great</item>
    <item>Who buys WonderWidgets</item>
  </slide>
</slideshow>`

type CompressionKind = 'gzip' | 'deflate' | 'brotli'

type DigestAlgorithm = 'MD5' | 'SHA-256' | 'SHA-512'

type StatusChoice = {
  code: number
  weight: number
}

type DigestCredentials = Record<string, string>

const ASCII_ART = [
  '    -=[ teapot ]=-',
  '',
  '       _...._',
  "     .'  _ _ `.",
  '    | ."` ^ `". _,',
  '    \\_;`"---"`|//',
  '      |       ;/',
  '      \\_     _/',
  '        `"""`'
].join('\n')

const ACCEPTED_MEDIA_TYPES = [
  'image/webp',
  'image/svg+xml',
  'image/jpeg',
  'image/png',
  'image/*'
]

const DIGEST_REALM = 'me@kennethreitz.com'
const MAX_BYTES = 100 * 1024

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0L+U0AAAAASUVORK5CYII=',
  'base64'
)

const PLACEHOLDER_BINARY = PNG_BYTES

const SVG_IMAGE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="18" fill="#2d3748"/>
  <circle cx="60" cy="48" r="22" fill="#63b3ed"/>
  <path d="M28 98c8-18 24-28 32-28s24 10 32 28" fill="#90cdf4"/>
  <text x="60" y="114" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#e2e8f0">bun-httpbin</text>
</svg>`

const HTML_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>httpbin</title></head>
  <body><h1>httpbin</h1><p>HTML response for compatibility.</p></body>
</html>`

const LEGACY_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>httpbin legacy</title></head>
  <body><h1>httpbin legacy</h1><p>Legacy landing page.</p></body>
</html>`

const UTF8_PAGE = `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>UTF-8 demo</title></head>
  <body><p>你好，httpbin。Привет, мир。こんにちは世界。</p></body>
</html>`

const FORMS_POST_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Forms</title></head>
  <body>
    <form method="post" action="/post">
      <input name="name" value="demo" />
      <button type="submit">Submit</button>
    </form>
  </body>
</html>`

function buildRequestPayload(
  context: RequestContext,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...buildEchoPayload(context),
    data: context.body.data,
    files: context.body.files,
    form: context.body.form,
    json: context.body.json,
    method: context.method,
    ...extras
  }
}

function headersFromQuery(
  context: RequestContext
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {}
  const searchParams = new URL(context.url).searchParams

  for (const [key, value] of searchParams.entries()) {
    appendMultiValue(headers, key, value)
  }

  return headers
}

function appendMultiValue(
  target: Record<string, string | string[]>,
  key: string,
  value: string
): void {
  const current = target[key]

  if (current === undefined) {
    target[key] = value
    return
  }

  if (Array.isArray(current)) {
    current.push(value)
    return
  }

  target[key] = [current, value]
}

function buildTextResponse(body: string, contentType: string): Response {
  return textResponse(body, {}, contentType)
}

function buildImageResponse(contentType: string, body: BodyInit): Response {
  return binaryResponse(body, {}, contentType)
}

function parseHeaderList(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeEntityTag)
}

function normalizeEntityTag(tag: string): string {
  const withoutWeakPrefix = tag.replace(/^W\//i, '')
  if (withoutWeakPrefix.startsWith('"') && withoutWeakPrefix.endsWith('"')) {
    return withoutWeakPrefix.slice(1, -1)
  }

  return withoutWeakPrefix
}

function makeStatusCodeResponse(code: number): Response {
  const redirectHeaders = { location: '/redirect/1' }

  switch (code) {
    case 301:
    case 302:
    case 303:
    case 305:
    case 307:
      return new Response(null, { status: code, headers: redirectHeaders })
    case 304:
      return new Response(null, { status: 304 })
    case 401:
      return new Response(null, {
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="Fake Realm"' }
      })
    case 402:
      return textResponse('Fuck you, pay me!', {
        status: 402,
        headers: { 'x-more-info': 'http://vimeo.com/22053820' }
      })
    case 406:
      return jsonResponse(
        {
          message: 'Client did not request a supported media type.',
          accept: ACCEPTED_MEDIA_TYPES
        },
        {
          status: 406,
          headers: { 'content-type': 'application/json' }
        }
      )
    case 407:
      return new Response(null, {
        status: 407,
        headers: { 'proxy-authenticate': 'Basic realm="Fake Realm"' }
      })
    case 418:
      return textResponse(ASCII_ART, {
        status: 418,
        headers: { 'x-more-info': 'http://tools.ietf.org/html/rfc2324' }
      })
    default:
      return new Response(null, { status: code })
  }
}

function parseStatusChoices(codes: string): StatusChoice[] | null {
  const choices: StatusChoice[] = []

  for (const rawChoice of codes.split(',')) {
    const choice = rawChoice.trim()
    if (!choice) {
      return null
    }

    const [codePart, weightPart] = choice.split(':')
    const code = Number(codePart)
    const weight = weightPart === undefined ? 1 : Number(weightPart)

    if (
      !Number.isInteger(code) ||
      code < 100 ||
      code > 599 ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      return null
    }

    choices.push({ code, weight })
  }

  return choices
}

function chooseWeightedStatus(choices: StatusChoice[]): number {
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0)
  if (totalWeight <= 0) {
    return choices[0]?.code ?? 500
  }

  let threshold = Math.random() * totalWeight
  for (const choice of choices) {
    threshold -= choice.weight
    if (threshold <= 0) {
      return choice.code
    }
  }

  return choices.at(-1)?.code ?? 500
}

function parseRangeHeader(
  rangeHeader: string | null,
  upperBound: number
): { first: number; last: number } | null {
  if (!rangeHeader) {
    return { first: 0, last: upperBound - 1 }
  }

  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i)
  if (!match) {
    return null
  }

  const left = match[1] ? Number(match[1]) : null
  const right = match[2] ? Number(match[2]) : null

  if (
    (left !== null && !Number.isInteger(left)) ||
    (right !== null && !Number.isInteger(right))
  ) {
    return null
  }

  if (left === null && right === null) {
    return null
  }

  let first: number
  let last: number

  if (left === null) {
    const suffixLength = right ?? 0
    first = Math.max(0, upperBound - suffixLength)
    last = upperBound - 1
  } else {
    first = left
    last = right ?? upperBound - 1
  }

  return { first, last }
}

function buildRangeBytes(length: number, firstByte: number): Uint8Array {
  const bytes = new Uint8Array(length)

  for (let index = 0; index < length; index += 1) {
    bytes[index] = 97 + ((firstByte + index) % 26)
  }

  return bytes
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function parseNumberParam(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDigestAlgorithm(value: string | undefined): DigestAlgorithm {
  switch ((value ?? 'MD5').toUpperCase()) {
    case 'SHA-256':
      return 'SHA-256'
    case 'SHA-512':
      return 'SHA-512'
    default:
      return 'MD5'
  }
}

function digestHash(
  value: string | Uint8Array,
  algorithm: DigestAlgorithm
): string {
  const nodeAlgorithm =
    algorithm === 'MD5' ? 'md5' : algorithm === 'SHA-256' ? 'sha256' : 'sha512'
  return createHash(nodeAlgorithm).update(value).digest('hex')
}

function parseDigestAuthorization(
  headerValue: string | null
): DigestCredentials | null {
  if (!headerValue?.startsWith('Digest ')) {
    return null
  }

  const credentials: DigestCredentials = {}
  const payload = headerValue.slice('Digest '.length)
  const pattern = /([a-zA-Z][\w-]*)=(?:"([^"]*)"|([^,]*))/g

  for (
    let match = pattern.exec(payload);
    match !== null;
    match = pattern.exec(payload)
  ) {
    const key = match[1]?.toLowerCase()
    const value = (match[2] ?? match[3] ?? '').trim()

    if (key) {
      credentials[key] = value
    }
  }

  return Object.keys(credentials).length > 0 ? credentials : null
}

function buildDigestRequestUri(context: RequestContext): string {
  const url = new URL(context.url)
  return `${url.pathname}${url.search}`
}

function setCookieHeaders(
  headers: Headers,
  cookies: Record<string, string>
): void {
  for (const [key, value] of Object.entries(cookies)) {
    headers.append('set-cookie', `${key}=${value}; Path=/`)
  }
}

function buildDigestChallengeResponse(
  qop: 'auth' | 'auth-int' | null,
  algorithm: DigestAlgorithm,
  stale = false,
  cookies: Record<string, string> = {}
): Response {
  const nonce = digestHash(
    `${crypto.randomUUID()}:${Date.now()}:${Math.random()}`,
    algorithm
  )
  const opaque = digestHash(
    `${crypto.randomUUID()}:${Date.now()}:${Math.random()}`,
    algorithm
  )
  const challengeQop = qop ?? 'auth,auth-int'
  const headers = new Headers({
    'www-authenticate': `Digest realm="${DIGEST_REALM}", nonce="${nonce}", opaque="${opaque}", qop="${challengeQop}", algorithm=${algorithm}${stale ? ', stale=TRUE' : ''}`
  })

  setCookieHeaders(headers, cookies)

  return new Response(null, {
    status: 401,
    headers
  })
}

function computeDigestResponse(
  credentials: DigestCredentials,
  user: string,
  password: string,
  method: string,
  uri: string,
  body: string,
  algorithm: DigestAlgorithm
): string {
  const qop = credentials.qop?.toLowerCase()
  const ha1 = digestHash(`${user}:${DIGEST_REALM}:${password}`, algorithm)
  const ha2Base =
    qop === 'auth-int'
      ? `${method}:${uri}:${digestHash(body, algorithm)}`
      : `${method}:${uri}`
  const ha2 = digestHash(ha2Base, algorithm)

  if (qop === 'auth' || qop === 'auth-int') {
    const nonce = credentials.nonce ?? ''
    const nc = credentials.nc ?? ''
    const cnonce = credentials.cnonce ?? ''

    return digestHash(
      `${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`,
      algorithm
    )
  }

  const nonce = credentials.nonce ?? ''
  return digestHash(`${ha1}:${nonce}:${ha2}`, algorithm)
}

function nextStaleAfterValue(staleAfter: string): string {
  const parsed = Number(staleAfter)
  if (!Number.isInteger(parsed)) {
    return 'never'
  }

  return String(parsed - 1)
}

function buildLinksPage(n: number, offset: number): Response {
  const totalLinks = Math.min(Math.max(1, n), 200)
  const safeOffset = Math.min(Math.max(0, offset), totalLinks - 1)
  const html = ['<html><head><title>Links</title></head><body>']

  for (let index = 0; index < totalLinks; index += 1) {
    if (index === safeOffset) {
      html.push(`${index} `)
      continue
    }

    html.push(`<a href="/links/${totalLinks}/${index}">${index}</a> `)
  }

  html.push('</body></html>')
  return buildPageResponse(html.join(''), 'text/html; charset=utf-8')
}

function buildFormPage(): Response {
  return buildTextResponse(FORMS_POST_PAGE, 'text/html; charset=utf-8')
}

function buildPageResponse(
  html: string,
  contentType = 'text/html; charset=utf-8'
): Response {
  return buildTextResponse(html, contentType)
}

export function handleStatus(statusCode: number): Response {
  if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    return errorResponse(400, 'Invalid status code')
  }

  return makeStatusCodeResponse(statusCode)
}

export function handleStatusCodes(codes: string): Response {
  if (!codes.includes(',')) {
    const code = Number(codes)
    if (!Number.isInteger(code)) {
      return errorResponse(400, 'Invalid status code')
    }

    return handleStatus(code)
  }

  const choices = parseStatusChoices(codes)
  if (!choices || choices.length === 0) {
    return errorResponse(400, 'Invalid status code')
  }

  return makeStatusCodeResponse(chooseWeightedStatus(choices))
}

export function handleRedirect(
  context: RequestContext,
  count: number
): Response {
  const absolute =
    (
      new URL(context.url).searchParams.get('absolute') ?? 'false'
    ).toLowerCase() === 'true'
  const location =
    count > 1
      ? absolute
        ? new URL(`/absolute-redirect/${count - 1}`, context.url).toString()
        : `/redirect/${count - 1}`
      : absolute
        ? new URL('/get', context.url).toString()
        : '/get'
  return redirectResponse(location, 302)
}

export function handleRelativeRedirect(count: number): Response {
  const location = count > 1 ? `../relative-redirect/${count - 1}` : '/get'
  return redirectResponse(location, 302)
}

export function handleAbsoluteRedirect(
  context: RequestContext,
  count: number
): Response {
  const location =
    count > 1
      ? new URL(`/absolute-redirect/${count - 1}`, context.url).toString()
      : new URL('/get', context.url).toString()
  return redirectResponse(location, 302)
}

export function handleRedirectTo(context: RequestContext): Response {
  const requestParams = new URL(context.url).searchParams
  const url = requestParams.get('url') ?? getFormValue(context.body.form, 'url')

  if (!url) {
    return errorResponse(400, 'Missing redirect URL')
  }

  const statusCandidate =
    requestParams.get('status_code') ??
    getFormValue(context.body.form, 'status_code')
  const statusCode = parseNumberParam(statusCandidate ?? undefined)
  const finalStatus =
    statusCode !== null && statusCode >= 300 && statusCode < 400
      ? statusCode
      : 302

  return redirectResponse(url, finalStatus)
}

export function handleAnything(context: RequestContext): Response {
  return jsonResponse(buildRequestPayload(context))
}

export function handleLinks(n: number, offset: number): Response {
  return buildLinksPage(n, offset)
}

export async function handleDrip(context: RequestContext): Promise<Response> {
  const params = new URL(context.url).searchParams
  const duration = parseNumberParam(params.get('duration') ?? undefined) ?? 2
  const numbytes = parseNumberParam(params.get('numbytes') ?? undefined) ?? 10
  const code = parseNumberParam(params.get('code') ?? undefined) ?? 200
  const delay = parseNumberParam(params.get('delay') ?? undefined) ?? 0

  if (numbytes <= 0) {
    return errorResponse(400, 'number of bytes must be positive')
  }

  if (delay > 0) {
    await Bun.sleep(delay * 1000)
  }

  const totalBytes = Math.min(Math.floor(numbytes), 10 * 1024 * 1024)
  const bytes = new Uint8Array(totalBytes)
  bytes.fill(42)

  const response = binaryResponse(
    bytes,
    {
      headers: {
        'content-length': String(totalBytes)
      },
      status: Number.isInteger(code) ? code : 200
    },
    'application/octet-stream'
  )

  void duration
  return response
}

export function handleResponseHeaders(context: RequestContext): Response {
  const responseHeaders = new Headers()
  const payload = headersFromQuery(context)

  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        responseHeaders.append(key, item)
      }
      continue
    }

    responseHeaders.append(key, value)
  }

  return jsonResponse(payload, { headers: responseHeaders })
}

export function handleCache(context: RequestContext): Response {
  const requestHeaders = context.headers

  if (
    requestHeaders['if-modified-since'] !== undefined ||
    requestHeaders['if-none-match'] !== undefined
  ) {
    return new Response(null, { status: 304 })
  }

  const response = jsonResponse(buildEchoPayload(context))
  response.headers.set('last-modified', new Date().toUTCString())
  response.headers.set('etag', 'cache')
  return response
}

export function handleCacheControl(
  context: RequestContext,
  value: number
): Response {
  const response = jsonResponse(buildEchoPayload(context))
  response.headers.set('cache-control', `public, max-age=${value}`)
  return response
}

export function handleDigestAuth(
  context: RequestContext,
  qop: string,
  user: string,
  password: string,
  algorithm = 'MD5',
  staleAfter = 'never'
): Response {
  const normalizedAlgorithm = normalizeDigestAlgorithm(algorithm)
  const normalizedQop = qop === 'auth' || qop === 'auth-int' ? qop : null
  const authorization = getHeaderValue(context.headers, 'authorization')
  const credentials = parseDigestAuthorization(authorization)
  const requestUri = buildDigestRequestUri(context)

  if (!credentials) {
    return buildDigestChallengeResponse(
      normalizedQop,
      normalizedAlgorithm,
      false,
      {
        stale_after: staleAfter
      }
    )
  }

  const incomingNonce = credentials.nonce ?? ''
  const staleCookie = context.cookies.stale_after ?? null

  if (
    staleCookie === '0' ||
    (context.cookies.last_nonce !== undefined &&
      context.cookies.last_nonce === incomingNonce)
  ) {
    return buildDigestChallengeResponse(
      normalizedQop,
      normalizedAlgorithm,
      true,
      {
        stale_after: staleAfter
      }
    )
  }

  const expectedResponse = computeDigestResponse(
    credentials,
    user,
    password,
    context.method,
    requestUri,
    context.body.data,
    normalizeDigestAlgorithm(credentials.algorithm ?? normalizedAlgorithm)
  )

  if ((credentials.response ?? '') !== expectedResponse) {
    return buildDigestChallengeResponse(
      normalizedQop,
      normalizedAlgorithm,
      false,
      {
        last_nonce: incomingNonce,
        stale_after: staleAfter
      }
    )
  }

  const response = jsonResponse({ authenticated: true, user })

  if (staleCookie !== null && staleCookie !== 'never') {
    response.headers.append(
      'set-cookie',
      `stale_after=${nextStaleAfterValue(staleCookie)}; Path=/`
    )
  }

  return response
}

export function handleEtag(context: RequestContext, etag: string): Response {
  const ifNoneMatch = parseHeaderList(
    getHeaderValue(context.headers, 'if-none-match')
  )
  const ifMatch = parseHeaderList(getHeaderValue(context.headers, 'if-match'))

  if (ifNoneMatch.length > 0) {
    if (ifNoneMatch.includes(etag) || ifNoneMatch.includes('*')) {
      return new Response(null, {
        status: 304,
        headers: { etag }
      })
    }
  } else if (ifMatch.length > 0) {
    if (!ifMatch.includes(etag) && !ifMatch.includes('*')) {
      return new Response(null, { status: 412 })
    }
  }

  const response = jsonResponse(buildEchoPayload(context))
  response.headers.set('etag', etag)
  return response
}

export function handleHiddenBasicAuth(
  context: RequestContext,
  expectedUser: string,
  expectedPassword: string
): Response {
  if (!isBasicAuthValid(context, expectedUser, expectedPassword)) {
    return new Response(null, { status: 404 })
  }

  return jsonResponse({ authenticated: true, user: expectedUser })
}

export function handleFormsPost(): Response {
  return buildFormPage()
}

export function handleHtml(): Response {
  return buildPageResponse(HTML_PAGE)
}

export function handleLegacy(): Response {
  return buildPageResponse(LEGACY_PAGE)
}

export function handleEncodingUtf8(): Response {
  return buildPageResponse(UTF8_PAGE)
}

export function handleImagePng(): Response {
  return buildImageResponse('image/png', PNG_BYTES)
}

export function handleImageJpeg(): Response {
  return buildImageResponse('image/jpeg', PLACEHOLDER_BINARY)
}

export function handleImageWebp(): Response {
  return buildImageResponse('image/webp', PLACEHOLDER_BINARY)
}

export function handleImageSvg(): Response {
  return buildImageResponse('image/svg+xml', SVG_IMAGE)
}

export function handleImage(context: RequestContext): Response {
  const accept = getHeaderValue(context.headers, 'accept')?.toLowerCase() ?? ''

  if (!accept) {
    return handleImagePng()
  }

  if (accept.includes('image/webp')) {
    return handleImageWebp()
  }

  if (accept.includes('image/svg+xml')) {
    return handleImageSvg()
  }

  if (accept.includes('image/jpeg')) {
    return handleImageJpeg()
  }

  if (accept.includes('image/png') || accept.includes('image/*')) {
    return handleImagePng()
  }

  return makeStatusCodeResponse(406)
}

export function handleStreamBytes(
  context: RequestContext,
  size: number
): Response {
  const params = new URL(context.url).searchParams
  const seedValue = parseNumberParam(params.get('seed') ?? undefined)
  const chunkSizeValue = parseNumberParam(params.get('chunk_size') ?? undefined)
  const chunkSize = Math.max(1, chunkSizeValue ?? 10240)
  const randomBytes = seedValue === null ? null : createSeededRng(seedValue)

  if (!Number.isInteger(size) || size < 0) {
    return errorResponse(400, 'Invalid byte length')
  }

  const totalBytes = Math.min(size, MAX_BYTES)
  const bytes = new Uint8Array(totalBytes)

  for (let index = 0; index < totalBytes; index += 1) {
    bytes[index] = randomBytes
      ? Math.floor(randomBytes() * 256)
      : crypto.getRandomValues(new Uint8Array(1))[0]!
  }

  void chunkSize

  return binaryResponse(
    Buffer.from(bytes),
    {
      headers: {
        'content-length': String(totalBytes)
      }
    },
    'application/octet-stream'
  )
}

export function handleRange(
  context: RequestContext,
  numbytes: number
): Response {
  if (!Number.isInteger(numbytes) || numbytes <= 0 || numbytes > MAX_BYTES) {
    return new Response('number of bytes must be in the range (0, 102400]', {
      status: 404,
      headers: {
        etag: `range${numbytes}`,
        'accept-ranges': 'bytes'
      }
    })
  }

  const requestRange = parseRangeHeader(
    getHeaderValue(context.headers, 'range'),
    numbytes
  )
  if (!requestRange) {
    return new Response(null, {
      status: 416,
      headers: {
        etag: `range${numbytes}`,
        'accept-ranges': 'bytes',
        'content-range': `bytes */${numbytes}`,
        'content-length': '0'
      }
    })
  }

  const { first, last } = requestRange
  if (first > last || first < 0 || last >= numbytes) {
    return new Response(null, {
      status: 416,
      headers: {
        etag: `range${numbytes}`,
        'accept-ranges': 'bytes',
        'content-range': `bytes */${numbytes}`,
        'content-length': '0'
      }
    })
  }

  const rangeLength = last - first + 1
  const bytes = buildRangeBytes(rangeLength, first)
  return new Response(Buffer.from(bytes), {
    status: first === 0 && last === numbytes - 1 ? 200 : 206,
    headers: {
      'content-type': 'application/octet-stream',
      etag: `range${numbytes}`,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${first}-${last}/${numbytes}`,
      'content-length': String(rangeLength)
    }
  })
}

function getFormValue(
  form: Record<string, string | string[]>,
  key: string
): string | null {
  const value = form[key]
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export function handleCookiesSetByNameValue(
  name: string,
  value: string
): Response {
  const headers = new Headers({ location: '/cookies' })
  headers.append('set-cookie', `${name}=${value}; Path=/`)
  return new Response(null, { status: 302, headers })
}

function isBasicAuthValid(
  context: RequestContext,
  expectedUser: string,
  expectedPassword: string
): boolean {
  const authorization = getHeaderValue(context.headers, 'authorization')
  if (!authorization?.startsWith('Basic ')) {
    return false
  }

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString(
      'utf8'
    )
    const separatorIndex = decoded.indexOf(':')
    const user =
      separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded
    const password =
      separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : ''

    return user === expectedUser && password === expectedPassword
  } catch {
    return false
  }
}

export function handleCookies(context: RequestContext): Response {
  return jsonResponse({ cookies: context.cookies })
}

export function handleCookiesSet(context: RequestContext): Response {
  const headers = new Headers({ location: '/cookies' })
  appendCookieHeaders(headers, context.args)
  return new Response(null, { status: 302, headers })
}

export function handleCookiesDelete(context: RequestContext): Response {
  const headers = new Headers({ location: '/cookies' })
  appendCookieDeletionHeaders(headers, context.args)
  return new Response(null, { status: 302, headers })
}

export function handleBasicAuth(
  context: RequestContext,
  expectedUser: string,
  expectedPassword: string
): Response {
  const authorization = getHeaderValue(context.headers, 'authorization')
  if (!authorization?.startsWith('Basic ')) {
    return unauthorizedBasic()
  }

  const decoded = decodeBase64(authorization.slice(6))
  if (decoded === null) {
    return unauthorizedBasic()
  }

  const separatorIndex = decoded.indexOf(':')
  const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : ''

  if (user !== expectedUser || password !== expectedPassword) {
    return unauthorizedBasic()
  }

  return jsonResponse({ authenticated: true, user: expectedUser })
}

export function handleBearer(context: RequestContext): Response {
  const authorization = getHeaderValue(context.headers, 'authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return unauthorizedBearer()
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) {
    return unauthorizedBearer()
  }

  return jsonResponse({ authenticated: true, token })
}

export function handleUuid(): Response {
  return jsonResponse({ uuid: crypto.randomUUID() })
}

export function handleBase64(value: string): Response {
  const decoded = decodeBase64(value)
  if (decoded === null) {
    return errorResponse(400, 'Invalid base64 encoded data')
  }

  return textResponse(decoded)
}

export function handleBytes(size: number): Response {
  if (!Number.isInteger(size) || size < 0) {
    return errorResponse(400, 'Invalid byte length')
  }

  const bytes = new Uint8Array(Math.min(size, MAX_BYTES))
  fillRandomBytes(bytes)
  return binaryResponse(bytes)
}

export async function handleDelay(
  context: RequestContext,
  seconds: number
): Promise<Response> {
  if (!Number.isInteger(seconds) || seconds < 0) {
    return errorResponse(400, 'Invalid delay')
  }

  const delaySeconds = Math.min(seconds, 10)
  await Bun.sleep(delaySeconds * 1000)
  return jsonResponse(buildEchoPayload(context))
}

export function handleStream(context: RequestContext, count: number): Response {
  if (!Number.isInteger(count) || count < 0) {
    return errorResponse(400, 'Invalid stream count')
  }

  const encoder = new TextEncoder()
  const total = Math.min(count, 100)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < total; index += 1) {
        const payload = {
          ...buildEchoPayload(context),
          id: index
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8'
    }
  })
}

export function handleJson(): Response {
  return jsonResponse(SLIDESHOW_JSON)
}

export function handleXml(): Response {
  return textResponse(SLIDESHOW_XML, {}, 'application/xml; charset=utf-8')
}

export function handleRobotsTxt(): Response {
  return textResponse('User-agent: *\nDisallow: /deny\n')
}

export function handleDeny(): Response {
  return new Response('Access denied', {
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    },
    status: 403
  })
}

export function handleCompressed(
  context: RequestContext,
  kind: CompressionKind
): Response {
  const body = JSON.stringify(
    {
      ...buildEchoPayload(context),
      [kind === 'gzip'
        ? 'gzipped'
        : kind === 'deflate'
          ? 'deflated'
          : 'brotli']: true
    },
    null,
    2
  )

  const compressed =
    kind === 'gzip'
      ? gzipSync(body)
      : kind === 'deflate'
        ? deflateSync(body)
        : brotliCompressSync(body)

  return binaryResponse(
    compressed,
    {
      headers: {
        'content-encoding': kind === 'brotli' ? 'br' : kind
      }
    },
    'application/json; charset=utf-8'
  )
}

function appendCookieHeaders(headers: Headers, args: KeyValueMap): void {
  forEachQueryValue(args, (key, value) => {
    headers.append('set-cookie', `${key}=${value}; Path=/`)
  })
}

function appendCookieDeletionHeaders(
  headers: Headers,
  args: KeyValueMap
): void {
  forEachQueryValue(args, (key) => {
    headers.append(
      'set-cookie',
      `${key}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    )
  })
}

function forEachQueryValue(
  args: KeyValueMap,
  callback: (key: string, value: string) => void
): void {
  for (const [key, value] of Object.entries(args)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        callback(key, item)
      }

      continue
    }

    callback(key, value)
  }
}

function getHeaderValue(headers: KeyValueMap, name: string): string | null {
  const headerValue = headers[name.toLowerCase()]
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null
  }

  return headerValue ?? null
}

function decodeBase64(value: string): string | null {
  try {
    const normalized = normalizeBase64(value)
    const binary = atob(normalized)
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    )
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function normalizeBase64(value: string): string {
  const urlSafe = value.replace(/-/g, '+').replace(/_/g, '/')
  const paddingLength = (4 - (urlSafe.length % 4)) % 4
  return `${urlSafe}${'='.repeat(paddingLength)}`
}

function fillRandomBytes(bytes: Uint8Array): void {
  const chunkSize = 65536

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + chunkSize, bytes.length)
    )
    globalThis.crypto.getRandomValues(chunk)
  }
}

function unauthorizedBasic(): Response {
  return new Response(null, {
    headers: {
      'www-authenticate': 'Basic realm="Fake Realm"'
    },
    status: 401
  })
}

function unauthorizedBearer(): Response {
  return new Response(null, {
    headers: {
      'www-authenticate': 'Bearer'
    },
    status: 401
  })
}
