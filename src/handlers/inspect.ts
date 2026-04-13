import type { RequestContext } from "../http/request-context";
import { jsonResponse } from "../http/response";

export function handleHeaders(context: RequestContext): Response {
  return jsonResponse({
    headers: context.headers,
  });
}

export function handleIp(context: RequestContext): Response {
  return jsonResponse({
    origin: context.origin,
  });
}

export function handleUserAgent(context: RequestContext): Response {
  return jsonResponse({
    "user-agent": context.userAgent,
  });
}
