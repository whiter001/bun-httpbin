import type { RequestContext } from "../http/request-context";
import { jsonResponse } from "../http/response";

export function handleGet(context: RequestContext): Response {
  return jsonResponse({
    args: context.args,
    headers: context.headers,
    origin: context.origin,
    url: context.url,
  });
}

export function handleMethodEcho(context: RequestContext): Response {
  return jsonResponse({
    args: context.args,
    data: context.body.data,
    files: context.body.files,
    form: context.body.form,
    headers: context.headers,
    json: context.body.json,
    method: context.method,
    origin: context.origin,
    url: context.url,
  });
}
