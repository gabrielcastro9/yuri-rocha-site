import { handleApi } from "./router.mjs";

export const GET = handleApi;
export const POST = handleApi;
export const PUT = handleApi;
export const PATCH = handleApi;
export const DELETE = handleApi;
export const OPTIONS = handleApi;

function readNodeBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body));
  if (req.body && typeof req.body === "object") {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  const method = req.method || "GET";
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    init.body = await readNodeBody(req);
    init.duplex = "half";
  }
  const response = await handleApi(new Request(url, init));
  res.statusCode = response.status;
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}
