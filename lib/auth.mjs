import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { clientIp, isSecureRequest, json, parseCookies } from "./http.mjs";

export const COOKIE_NAME = "yfr_session";
const IDLE_MS = 20 * 60 * 1000;
const MAX_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();

function secret() {
  const value = String(process.env.SESSION_SECRET || "").trim();
  if (value.length >= 16) return value;
  if (process.env.VERCEL) {
    throw new Error("SESSION_SECRET ausente. Defina uma string longa nas variáveis da Vercel.");
  }
  if (!process.env.SESSION_SECRET_DEV) {
    process.env.SESSION_SECRET_DEV = randomBytes(32).toString("hex");
  }
  return process.env.SESSION_SECRET_DEV;
}

function adminUser() {
  const fromEnv = String(process.env.ADMIN_USER || "").trim();
  if (fromEnv) return fromEnv;
  return process.env.VERCEL ? "" : "admin";
}

function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || "");
}

export function authConfigured() {
  return Boolean(adminUser() && adminPassword() && (process.env.SESSION_SECRET || !process.env.VERCEL));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (!left.length || left.length !== right.length) {
    const dummy = Buffer.alloc(32);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(left, right);
}

function sign(payload) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(username, issuedAt = Date.now()) {
  const now = Date.now();
  const iat = Number(issuedAt) || now;
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    iat,
    exp: Math.min(now + IDLE_MS, iat + MAX_MS)
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(request) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Date.now();
    if (!data?.sub || !data.iat || !data.exp) return null;
    if (Number(data.exp) < now || Number(data.iat) + MAX_MS < now) return null;
    if (!safeEqual(data.sub, adminUser())) return null;
    return { user: data.sub, iat: Number(data.iat), exp: Number(data.exp) };
  } catch {
    return null;
  }
}

export function sessionCookie(token, request, clear = false) {
  const parts = [
    `${COOKIE_NAME}=${clear ? "" : encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict"
  ];
  if (clear) parts.push("Max-Age=0");
  if (isSecureRequest(request)) parts.push("Secure");
  return parts.join("; ");
}

export function continueSession(request, response) {
  const path = new URL(request.url).pathname;
  if (path === "/api/login" || path === "/api/logout" || !response) return response;
  const session = readSession(request);
  if (!session) return response;
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", sessionCookie(createSessionToken(session.user, session.iat), request));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function requireUser(request) {
  return readSession(request);
}

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.reset < now) {
    loginAttempts.set(ip, { count: 0, reset: now + 15 * 60 * 1000 });
    return false;
  }
  return entry.count >= 8;
}

function recordAttempt(ip, success) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (entry.reset < now) {
    loginAttempts.set(ip, { count: success ? 0 : 1, reset: now + 15 * 60 * 1000 });
    return;
  }
  entry.count = success ? 0 : entry.count + 1;
  loginAttempts.set(ip, entry);
}

export function verifyCredentials(username, password, request) {
  const ip = clientIp(request);
  if (tooManyAttempts(ip)) {
    return { ok: false, status: 429, error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  if (!authConfigured()) {
    return { ok: false, status: 503, error: "Credenciais do painel não configuradas no servidor." };
  }
  const userOk = safeEqual(String(username || "").trim(), adminUser());
  const passOk = safeEqual(String(password || ""), adminPassword());
  const ok = userOk && passOk;
  recordAttempt(ip, ok);
  if (!ok) return { ok: false, status: 401, error: "Usuário ou senha incorretos." };
  return { ok: true, user: adminUser() };
}

export function sessionResponse(request, user, extra = {}) {
  return json({ user, ...extra });
}
