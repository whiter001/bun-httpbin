import { handleGet, handleMethodEcho } from "./handlers/echo";
import { handleHeaders, handleIp, handleUserAgent } from "./handlers/inspect";
import {
  handleAbsoluteRedirect,
  handleBasicAuth,
  handleBearer,
  handleBase64,
  handleBytes,
  handleCompressed,
  handleCookies,
  handleCookiesDelete,
  handleCookiesSet,
  handleDelay,
  handleDeny,
  handleJson,
  handleRedirect,
  handleRelativeRedirect,
  handleRobotsTxt,
  handleStatus,
  handleStream,
  handleUuid,
  handleXml,
} from "./handlers/httpbin";
import { buildRequestContext, InvalidBodyError } from "./http/request-context";
import { errorResponse } from "./http/response";

type FetchHandler = NonNullable<Bun.Serve.Options<undefined>["fetch"]>;

const routeKeys = new Set([
  "/get",
  "/post",
  "/put",
  "/patch",
  "/delete",
  "/headers",
  "/ip",
  "/user-agent",
  "/cookies",
  "/uuid",
  "/json",
  "/xml",
  "/robots.txt",
  "/deny",
]);

export function createFetchHandler(): FetchHandler {
  return async (request, server) => {
    try {
      const context = await buildRequestContext(request, server);

      if (context.path === "/get") {
        return context.method === "GET"
          ? handleGet(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (["/post", "/put", "/patch", "/delete"].includes(context.path)) {
        return context.method === context.path.slice(1).toUpperCase()
          ? handleMethodEcho(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/headers") {
        return context.method === "GET"
          ? handleHeaders(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/ip") {
        return context.method === "GET"
          ? handleIp(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/user-agent") {
        return context.method === "GET"
          ? handleUserAgent(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/cookies") {
        return context.method === "GET"
          ? handleCookies(context)
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/uuid") {
        return context.method === "GET" ? handleUuid() : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/json") {
        return context.method === "GET" ? handleJson() : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/xml") {
        return context.method === "GET" ? handleXml() : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/robots.txt") {
        return context.method === "GET"
          ? handleRobotsTxt()
          : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/deny") {
        return context.method === "GET" ? handleDeny() : errorResponse(405, "Method Not Allowed");
      }

      if (context.path === "/cookies/set") {
        return handleCookiesSet(context);
      }

      if (context.path === "/cookies/delete") {
        return handleCookiesDelete(context);
      }

      if (context.path === "/bearer") {
        return handleBearer(context);
      }

      const statusMatch = context.path.match(/^\/status\/(\d+)$/);
      if (statusMatch) {
        return handleStatus(Number(statusMatch[1]));
      }

      const redirectMatch = context.path.match(/^\/redirect\/(\d+)$/);
      if (redirectMatch) {
        return handleRedirect(Number(redirectMatch[1]));
      }

      const relativeRedirectMatch = context.path.match(/^\/relative-redirect\/(\d+)$/);
      if (relativeRedirectMatch) {
        return handleRelativeRedirect(Number(relativeRedirectMatch[1]));
      }

      const absoluteRedirectMatch = context.path.match(/^\/absolute-redirect\/(\d+)$/);
      if (absoluteRedirectMatch) {
        return handleAbsoluteRedirect(context, Number(absoluteRedirectMatch[1]));
      }

      const delayMatch = context.path.match(/^\/delay\/(\d+)$/);
      if (delayMatch) {
        return await handleDelay(context, Number(delayMatch[1]));
      }

      const streamMatch = context.path.match(/^\/stream\/(\d+)$/);
      if (streamMatch) {
        return handleStream(context, Number(streamMatch[1]));
      }

      const bytesMatch = context.path.match(/^\/bytes\/(\d+)$/);
      if (bytesMatch) {
        return handleBytes(Number(bytesMatch[1]));
      }

      const base64Match = context.path.match(/^\/base64\/(.+)$/);
      if (base64Match) {
        return handleBase64(decodeURIComponent(base64Match[1]));
      }

      const basicAuthMatch = context.path.match(/^\/basic-auth\/([^/]+)\/([^/]+)$/);
      if (basicAuthMatch) {
        return handleBasicAuth(
          context,
          decodeURIComponent(basicAuthMatch[1]),
          decodeURIComponent(basicAuthMatch[2]),
        );
      }

      if (context.path === "/gzip") {
        return handleCompressed(context, "gzip");
      }

      if (context.path === "/deflate") {
        return handleCompressed(context, "deflate");
      }

      if (context.path === "/brotli") {
        return handleCompressed(context, "brotli");
      }

      if (routeKeys.has(context.path)) {
        return errorResponse(405, "Method Not Allowed");
      }

      return errorResponse(404, "Not Found");
    } catch (error) {
      if (error instanceof InvalidBodyError) {
        return errorResponse(400, error.message);
      }

      return errorResponse(500, "Internal Server Error");
    }
  };
}
