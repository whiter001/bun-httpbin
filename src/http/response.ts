export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers,
  });
}

export function textResponse(
  body: string,
  init: ResponseInit = {},
  contentType = "text/plain; charset=utf-8",
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", contentType);

  return new Response(body, {
    ...init,
    headers,
  });
}

export function binaryResponse(
  body: BodyInit,
  init: ResponseInit = {},
  contentType = "application/octet-stream",
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", contentType);

  return new Response(body, {
    ...init,
    headers,
  });
}

export function redirectResponse(
  location: string,
  status = 302,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("location", location);

  return new Response(null, {
    ...init,
    headers,
    status,
  });
}

export function errorResponse(status: number, message: string): Response {
  return jsonResponse(
    {
      error: message,
      status,
    },
    { status },
  );
}
