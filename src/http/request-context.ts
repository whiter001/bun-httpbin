export class InvalidBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBodyError";
  }
}

export type HeaderValue = string | string[];
export type KeyValueMap = Record<string, HeaderValue>;
export type FileValue =
  | { name: string; size: number; type: string }
  | Array<{ name: string; size: number; type: string }>;
export type FileMap = Record<string, FileValue>;

export interface ParsedBody {
  data: string;
  files: FileMap;
  form: KeyValueMap;
  json: unknown;
}

export interface RequestContext {
  args: KeyValueMap;
  body: ParsedBody;
  cookies: Record<string, string>;
  headers: KeyValueMap;
  method: string;
  origin: string;
  path: string;
  url: string;
  userAgent: string;
}

type RequestIpResolver = Pick<Bun.Server<undefined>, "requestIP">;

interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export async function buildRequestContext(
  request: Request,
  server: RequestIpResolver,
): Promise<RequestContext> {
  const url = new URL(request.url);

  return {
    args: collectSearchParams(url.searchParams),
    body: await parseBody(request),
    cookies: parseCookies(request.headers.get("cookie")),
    headers: collectHeaders(request.headers),
    method: request.method.toUpperCase(),
    origin: resolveOrigin(request, server),
    path: url.pathname,
    url: request.url,
    userAgent: request.headers.get("user-agent") ?? "",
  };
}

function collectHeaders(headers: Headers): KeyValueMap {
  const result: KeyValueMap = {};

  headers.forEach((value, key) => {
    appendValue(result, key.toLowerCase(), value);
  });

  return result;
}

function collectSearchParams(searchParams: URLSearchParams): KeyValueMap {
  const result: KeyValueMap = {};

  for (const [key, value] of searchParams.entries()) {
    appendValue(result, key, value);
  }

  return result;
}

function appendValue(target: KeyValueMap, key: string, value: string): void {
  const currentValue = target[key];

  if (currentValue === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(value);
    return;
  }

  target[key] = [currentValue, value];
}

function appendFile(
  target: FileMap,
  key: string,
  value: { name: string; size: number; type: string },
): void {
  const currentValue = target[key];

  if (currentValue === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(value);
    return;
  }

  target[key] = [currentValue, value];
}

async function parseBody(request: Request): Promise<ParsedBody> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const isBodyAllowed = !["GET", "HEAD"].includes(request.method.toUpperCase());

  if (!isBodyAllowed) {
    return emptyBody();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const form: KeyValueMap = {};
    const files: FileMap = {};

    formData.forEach((value, key) => {
      if (typeof value === "string") {
        appendValue(form, key, value);
        return;
      }

      appendFile(files, key, toFileMetadata(value));
    });

    return {
      data: "",
      files,
      form,
      json: null,
    };
  }

  const rawText = await request.text();

  if (rawText.length === 0) {
    return emptyBody();
  }

  if (contentType.includes("application/json")) {
    try {
      return {
        data: rawText,
        files: {},
        form: {},
        json: JSON.parse(rawText),
      };
    } catch {
      throw new InvalidBodyError("Invalid JSON body");
    }
  }

  return {
    data: rawText,
    files: {},
    form: {},
    json: null,
  };
}

function emptyBody(): ParsedBody {
  return {
    data: "",
    files: {},
    form: {},
    json: null,
  };
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");

    if (!rawName) {
      continue;
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join("="));
  }

  return cookies;
}

function resolveOrigin(request: Request, server: RequestIpResolver): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? forwardedFor;
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp;
  }

  return server.requestIP(request)?.address ?? "unknown";
}

function normalizeMimeType(value: string): string {
  return value.split(";")[0]?.trim() ?? value;
}

function toFileMetadata(file: File): FileMetadata {
  return {
    name: file.name,
    size: file.size,
    type: normalizeMimeType(file.type),
  };
}
