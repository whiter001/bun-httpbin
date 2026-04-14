import { handleGet, handleMethodEcho } from './handlers/echo'
import { handleHeaders, handleIp, handleUserAgent } from './handlers/inspect'
import {
  handleAbsoluteRedirect,
  handleAnything,
  handleBasicAuth,
  handleBearer,
  handleBase64,
  handleBytes,
  handleCache,
  handleCacheControl,
  handleEncodingUtf8,
  handleEtag,
  handleCompressed,
  handleCookies,
  handleCookiesDelete,
  handleCookiesSet,
  handleCookiesSetByNameValue,
  handleDelay,
  handleDeny,
  handleFormsPost,
  handleHtml,
  handleHiddenBasicAuth,
  handleImage,
  handleImageJpeg,
  handleImagePng,
  handleImageSvg,
  handleImageWebp,
  handleJson,
  handleDigestAuth,
  handleDrip,
  handleLinks,
  handleRange,
  handleRedirect,
  handleRedirectTo,
  handleRelativeRedirect,
  handleResponseHeaders,
  handleRobotsTxt,
  handleStatusCodes,
  handleStream,
  handleStreamBytes,
  handleLegacy,
  handleUuid,
  handleXml
} from './handlers/httpbin'
import { buildRequestContext, InvalidBodyError } from './http/request-context'
import { errorResponse, redirectResponse } from './http/response'

type FetchHandler = NonNullable<Bun.Serve.Options<undefined>['fetch']>

const routeKeys = new Set([
  '/',
  '/anything',
  '/get',
  '/post',
  '/put',
  '/patch',
  '/delete',
  '/response-headers',
  '/cache',
  '/drip',
  '/cookies/set',
  '/cookies/delete',
  '/basic-auth',
  '/hidden-basic-auth',
  '/bearer',
  '/forms/post',
  '/html',
  '/legacy',
  '/encoding/utf8',
  '/image',
  '/image/png',
  '/image/jpeg',
  '/image/webp',
  '/image/svg',
  '/headers',
  '/ip',
  '/user-agent',
  '/cookies',
  '/uuid',
  '/json',
  '/xml',
  '/robots.txt',
  '/deny'
])

const echoMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'TRACE'])

export function createFetchHandler(): FetchHandler {
  return async (request, server) => {
    try {
      const context = await buildRequestContext(request, server)

      if (context.path === '/') {
        return context.method === 'GET'
          ? handleLegacy()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/get') {
        return context.method === 'GET'
          ? handleGet(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (['/post', '/put', '/patch', '/delete'].includes(context.path)) {
        return context.method === context.path.slice(1).toUpperCase()
          ? handleMethodEcho(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (
        context.path === '/anything' ||
        context.path.startsWith('/anything/')
      ) {
        return echoMethods.has(context.method)
          ? handleAnything(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/headers') {
        return context.method === 'GET'
          ? handleHeaders(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/ip') {
        return context.method === 'GET'
          ? handleIp(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/user-agent') {
        return context.method === 'GET'
          ? handleUserAgent(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/cookies') {
        return context.method === 'GET'
          ? handleCookies(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/uuid') {
        return context.method === 'GET'
          ? handleUuid()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/json') {
        return context.method === 'GET'
          ? handleJson()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/xml') {
        return context.method === 'GET'
          ? handleXml()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/robots.txt') {
        return context.method === 'GET'
          ? handleRobotsTxt()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/deny') {
        return context.method === 'GET'
          ? handleDeny()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/html') {
        return context.method === 'GET'
          ? handleHtml()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/legacy') {
        return context.method === 'GET'
          ? handleLegacy()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/forms/post') {
        return context.method === 'GET'
          ? handleFormsPost()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/encoding/utf8') {
        return context.method === 'GET'
          ? handleEncodingUtf8()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/cookies/set') {
        return context.method === 'GET'
          ? handleCookiesSet(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      const cookiesSetMatch = context.path.match(
        /^\/cookies\/set\/([^/]+)\/([^/]+)$/
      )
      if (cookiesSetMatch) {
        return context.method === 'GET'
          ? handleCookiesSetByNameValue(
              decodeURIComponent(cookiesSetMatch[1]),
              decodeURIComponent(cookiesSetMatch[2])
            )
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/cookies/delete') {
        return context.method === 'GET'
          ? handleCookiesDelete(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/bearer') {
        return context.method === 'GET'
          ? handleBearer(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      const digestAuthMatch = context.path.match(
        /^\/digest-auth\/([^/]+)\/([^/]+)\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/
      )
      if (digestAuthMatch) {
        return context.method === 'GET'
          ? handleDigestAuth(
              context,
              decodeURIComponent(digestAuthMatch[1]),
              decodeURIComponent(digestAuthMatch[2]),
              decodeURIComponent(digestAuthMatch[3]),
              digestAuthMatch[4]
                ? decodeURIComponent(digestAuthMatch[4])
                : 'MD5',
              digestAuthMatch[5]
                ? decodeURIComponent(digestAuthMatch[5])
                : 'never'
            )
          : errorResponse(405, 'Method Not Allowed')
      }

      const hiddenBasicAuthMatch = context.path.match(
        /^\/hidden-basic-auth\/([^/]+)\/([^/]+)$/
      )
      if (hiddenBasicAuthMatch) {
        return context.method === 'GET'
          ? handleHiddenBasicAuth(
              context,
              decodeURIComponent(hiddenBasicAuthMatch[1]),
              decodeURIComponent(hiddenBasicAuthMatch[2])
            )
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/response-headers') {
        return ['GET', 'POST'].includes(context.method)
          ? handleResponseHeaders(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/cache') {
        return context.method === 'GET'
          ? handleCache(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      const cacheControlMatch = context.path.match(/^\/cache\/(\d+)$/)
      if (cacheControlMatch) {
        return context.method === 'GET'
          ? handleCacheControl(context, Number(cacheControlMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const etagMatch = context.path.match(/^\/etag\/(.+)$/)
      if (etagMatch) {
        return context.method === 'GET'
          ? handleEtag(context, decodeURIComponent(etagMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const redirectToMatch = context.path === '/redirect-to'
      if (redirectToMatch) {
        return echoMethods.has(context.method)
          ? handleRedirectTo(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      const linksRedirectMatch = context.path.match(/^\/links\/(\d+)$/)
      if (linksRedirectMatch) {
        return context.method === 'GET'
          ? redirectResponse(`/links/${linksRedirectMatch[1]}/0`, 302)
          : errorResponse(405, 'Method Not Allowed')
      }

      const linksMatch = context.path.match(/^\/links\/(\d+)\/(\d+)$/)
      if (linksMatch) {
        return context.method === 'GET'
          ? handleLinks(Number(linksMatch[1]), Number(linksMatch[2]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const statusMatch = context.path.match(/^\/status\/(.+)$/)
      if (statusMatch) {
        return handleStatusCodes(decodeURIComponent(statusMatch[1]))
      }

      const redirectMatch = context.path.match(/^\/redirect\/(\d+)$/)
      if (redirectMatch) {
        return handleRedirect(context, Number(redirectMatch[1]))
      }

      const relativeRedirectMatch = context.path.match(
        /^\/relative-redirect\/(\d+)$/
      )
      if (relativeRedirectMatch) {
        return handleRelativeRedirect(Number(relativeRedirectMatch[1]))
      }

      const absoluteRedirectMatch = context.path.match(
        /^\/absolute-redirect\/(\d+)$/
      )
      if (absoluteRedirectMatch) {
        return handleAbsoluteRedirect(context, Number(absoluteRedirectMatch[1]))
      }

      const delayMatch = context.path.match(/^\/delay\/(\d+)$/)
      if (delayMatch) {
        return await handleDelay(context, Number(delayMatch[1]))
      }

      if (context.path === '/drip') {
        return context.method === 'GET'
          ? await handleDrip(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      const streamMatch = context.path.match(/^\/stream\/(\d+)$/)
      if (streamMatch) {
        return context.method === 'GET'
          ? handleStream(context, Number(streamMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const streamBytesMatch = context.path.match(/^\/stream-bytes\/(\d+)$/)
      if (streamBytesMatch) {
        return context.method === 'GET'
          ? handleStreamBytes(context, Number(streamBytesMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const rangeMatch = context.path.match(/^\/range\/(\d+)$/)
      if (rangeMatch) {
        return context.method === 'GET'
          ? handleRange(context, Number(rangeMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const bytesMatch = context.path.match(/^\/bytes\/(\d+)$/)
      if (bytesMatch) {
        return context.method === 'GET'
          ? handleBytes(Number(bytesMatch[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const base64Match = context.path.match(/^\/base64\/(.+)$/)
      if (base64Match) {
        return context.method === 'GET'
          ? handleBase64(decodeURIComponent(base64Match[1]))
          : errorResponse(405, 'Method Not Allowed')
      }

      const basicAuthMatch = context.path.match(
        /^\/basic-auth\/([^/]+)\/([^/]+)$/
      )
      if (basicAuthMatch) {
        return handleBasicAuth(
          context,
          decodeURIComponent(basicAuthMatch[1]),
          decodeURIComponent(basicAuthMatch[2])
        )
      }

      if (context.path === '/gzip') {
        return context.method === 'GET'
          ? handleCompressed(context, 'gzip')
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/deflate') {
        return context.method === 'GET'
          ? handleCompressed(context, 'deflate')
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/brotli') {
        return context.method === 'GET'
          ? handleCompressed(context, 'brotli')
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/image') {
        return context.method === 'GET'
          ? handleImage(context)
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/image/png') {
        return context.method === 'GET'
          ? handleImagePng()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/image/jpeg') {
        return context.method === 'GET'
          ? handleImageJpeg()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/image/webp') {
        return context.method === 'GET'
          ? handleImageWebp()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (context.path === '/image/svg') {
        return context.method === 'GET'
          ? handleImageSvg()
          : errorResponse(405, 'Method Not Allowed')
      }

      if (routeKeys.has(context.path)) {
        return errorResponse(405, 'Method Not Allowed')
      }

      return errorResponse(404, 'Not Found')
    } catch (error) {
      if (error instanceof InvalidBodyError) {
        return errorResponse(400, error.message)
      }

      return errorResponse(500, 'Internal Server Error')
    }
  }
}
