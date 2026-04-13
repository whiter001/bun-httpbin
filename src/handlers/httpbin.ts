import { gzipSync, deflateSync, brotliCompressSync } from "node:zlib";

import type { KeyValueMap, RequestContext } from "../http/request-context";
import { buildEchoPayload } from "./echo";
import {
  binaryResponse,
  errorResponse,
  jsonResponse,
  redirectResponse,
  textResponse,
} from "../http/response";

const SLIDESHOW_JSON = {
  slideshow: {
    author: "Yours Truly",
    date: "date of publication",
    slides: [
      {
        title: "Wake up to WonderWidgets!",
        type: "all",
      },
      {
        items: ["Why <em>WonderWidgets</em> are great", "Who <em>buys</em> WonderWidgets"],
        title: "Overview",
        type: "all",
      },
    ],
    title: "Sample Slide Show",
  },
};

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
</slideshow>`;

type CompressionKind = "gzip" | "deflate" | "brotli";

export function handleStatus(statusCode: number): Response {
  if (!Number.isInteger(statusCode) || statusCode < 200 || statusCode > 599) {
    return errorResponse(400, "Invalid status code");
  }

  return new Response(null, { status: statusCode });
}

export function handleRedirect(count: number): Response {
  const location = count > 1 ? `/redirect/${count - 1}` : "/get";
  return redirectResponse(location, 302);
}

export function handleRelativeRedirect(count: number): Response {
  const location = count > 1 ? `../relative-redirect/${count - 1}` : "/get";
  return redirectResponse(location, 302);
}

export function handleAbsoluteRedirect(context: RequestContext, count: number): Response {
  const location =
    count > 1
      ? new URL(`/absolute-redirect/${count - 1}`, context.url).toString()
      : new URL("/get", context.url).toString();
  return redirectResponse(location, 302);
}

export function handleCookies(context: RequestContext): Response {
  return jsonResponse({ cookies: context.cookies });
}

export function handleCookiesSet(context: RequestContext): Response {
  const headers = new Headers({ location: "/cookies" });
  appendCookieHeaders(headers, context.args);
  return new Response(null, { status: 302, headers });
}

export function handleCookiesDelete(context: RequestContext): Response {
  const headers = new Headers({ location: "/cookies" });
  appendCookieDeletionHeaders(headers, context.args);
  return new Response(null, { status: 302, headers });
}

export function handleBasicAuth(
  context: RequestContext,
  expectedUser: string,
  expectedPassword: string,
): Response {
  const authorization = getHeaderValue(context.headers, "authorization");
  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedBasic();
  }

  const decoded = decodeBase64(authorization.slice(6));
  if (decoded === null) {
    return unauthorizedBasic();
  }

  const separatorIndex = decoded.indexOf(":");
  const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
  const password = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : "";

  if (user !== expectedUser || password !== expectedPassword) {
    return unauthorizedBasic();
  }

  return jsonResponse({ authenticated: true, user: expectedUser });
}

export function handleBearer(context: RequestContext): Response {
  const authorization = getHeaderValue(context.headers, "authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return unauthorizedBearer();
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    return unauthorizedBearer();
  }

  return jsonResponse({ authenticated: true, token });
}

export function handleUuid(): Response {
  return jsonResponse({ uuid: crypto.randomUUID() });
}

export function handleBase64(value: string): Response {
  const decoded = decodeBase64(value);
  if (decoded === null) {
    return errorResponse(400, "Invalid base64 encoded data");
  }

  return textResponse(decoded);
}

export function handleBytes(size: number): Response {
  if (!Number.isInteger(size) || size < 0) {
    return errorResponse(400, "Invalid byte length");
  }

  const bytes = new Uint8Array(size);
  fillRandomBytes(bytes);
  return binaryResponse(bytes);
}

export async function handleDelay(context: RequestContext, seconds: number): Promise<Response> {
  if (!Number.isInteger(seconds) || seconds < 0) {
    return errorResponse(400, "Invalid delay");
  }

  const delaySeconds = Math.min(seconds, 10);
  await Bun.sleep(delaySeconds * 1000);
  return jsonResponse(buildEchoPayload(context));
}

export function handleStream(context: RequestContext, count: number): Response {
  if (!Number.isInteger(count) || count < 0) {
    return errorResponse(400, "Invalid stream count");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < count; index += 1) {
        const payload = {
          ...buildEchoPayload(context),
          id: index,
        };
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  });
}

export function handleJson(): Response {
  return jsonResponse(SLIDESHOW_JSON);
}

export function handleXml(): Response {
  return textResponse(SLIDESHOW_XML, {}, "application/xml; charset=utf-8");
}

export function handleRobotsTxt(): Response {
  return textResponse("User-agent: *\nDisallow: /deny\n");
}

export function handleDeny(): Response {
  return new Response("Access denied", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    status: 403,
  });
}

export function handleCompressed(context: RequestContext, kind: CompressionKind): Response {
  const body = JSON.stringify(
    {
      ...buildEchoPayload(context),
      [kind === "gzip" ? "gzipped" : kind === "deflate" ? "deflated" : "brotli"]: true,
    },
    null,
    2,
  );

  const compressed =
    kind === "gzip"
      ? gzipSync(body)
      : kind === "deflate"
        ? deflateSync(body)
        : brotliCompressSync(body);

  return binaryResponse(
    compressed,
    {
      headers: {
        "content-encoding": kind === "brotli" ? "br" : kind,
      },
    },
    "application/json; charset=utf-8",
  );
}

function appendCookieHeaders(headers: Headers, args: KeyValueMap): void {
  forEachQueryValue(args, (key, value) => {
    headers.append("set-cookie", `${key}=${value}; Path=/`);
  });
}

function appendCookieDeletionHeaders(headers: Headers, args: KeyValueMap): void {
  forEachQueryValue(args, (key) => {
    headers.append(
      "set-cookie",
      `${key}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    );
  });
}

function forEachQueryValue(
  args: KeyValueMap,
  callback: (key: string, value: string) => void,
): void {
  for (const [key, value] of Object.entries(args)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        callback(key, item);
      }

      continue;
    }

    callback(key, value);
  }
}

function getHeaderValue(headers: KeyValueMap, name: string): string | null {
  const headerValue = headers[name.toLowerCase()];
  if (Array.isArray(headerValue)) {
    return headerValue[0] ?? null;
  }

  return headerValue ?? null;
}

function decodeBase64(value: string): string | null {
  try {
    const normalized = normalizeBase64(value);
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function normalizeBase64(value: string): string {
  const urlSafe = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (urlSafe.length % 4)) % 4;
  return `${urlSafe}${"=".repeat(paddingLength)}`;
}

function fillRandomBytes(bytes: Uint8Array): void {
  const chunkSize = 65536;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    globalThis.crypto.getRandomValues(chunk);
  }
}

function unauthorizedBasic(): Response {
  return new Response(null, {
    headers: {
      "www-authenticate": 'Basic realm="Fake Realm"',
    },
    status: 401,
  });
}

function unauthorizedBearer(): Response {
  return new Response(null, {
    headers: {
      "www-authenticate": "Bearer",
    },
    status: 401,
  });
}
