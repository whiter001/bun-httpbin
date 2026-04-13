import type { RequestContext } from "../http/request-context";
import { jsonResponse } from "../http/response";

export function buildEchoPayload(context: RequestContext): Record<string, unknown> {
  return {
    args: context.args,
    headers: context.headers,
    origin: context.origin,
    url: context.url,
  };
}

export function handleGet(context: RequestContext): Response {
  return jsonResponse(buildEchoPayload(context));
}

export function handleMethodEcho(context: RequestContext): Response {
  return jsonResponse({
    ...buildEchoPayload(context),
    data: context.body.data,
    files: context.body.files,
    form: context.body.form,
    json: context.body.json,
    method: context.method,
  });
}
