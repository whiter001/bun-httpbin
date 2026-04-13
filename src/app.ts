import { handleGet, handleMethodEcho } from "./handlers/echo";
import { handleHeaders, handleIp, handleUserAgent } from "./handlers/inspect";
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
