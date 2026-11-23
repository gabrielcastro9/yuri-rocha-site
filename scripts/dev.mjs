import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { handleApi } from "../lib/router.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preferredPort = Number(process.env.PORT) || 4173;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] == null) process.env[key] = value;
  }
}

function ensureLocalEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) {
    const secret = randomBytes(32).toString("hex");
    fs.writeFileSync(envPath, [
      "ADMIN_USER=admin",
      "ADMIN_PASSWORD=yuri2026",
      `SESSION_SECRET=${secret}`,
      ""
    ].join("\n"), "utf8");
    console.log("Arquivo .env.local criado com usuário admin. Troque a senha antes de publicar na Vercel.");
  }
  loadEnvFile(envPath, { override: true });
  console.log(`Painel local: usuário ${process.env.ADMIN_USER || "admin"}`);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function nodeToWebRequest(req) {
  const url = `http://${req.headers.host || "127.0.0.1"}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  const method = req.method || "GET";
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    init.body = await readBody(req);
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function writeWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers["set-cookie"] = cookies;
  }
  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headers);
  res.end(body);
}

function serveFile(req, res) {
  const url = new URL(req.url, "http://localhost");
  let filePath = path.normalize(path.join(root, decodeURIComponent(url.pathname)));

  if (url.pathname.startsWith("/uploads/")) {
    const relative = decodeURIComponent(url.pathname.slice("/uploads/".length));
    filePath = path.normalize(path.join(root, "data", "uploads", relative));
    if (!filePath.startsWith(path.join(root, "data", "uploads"))) {
      send(res, 403, "Acesso negado");
      return;
    }
  }

  if (!filePath.startsWith(root)) {
    send(res, 403, "Acesso negado");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!path.extname(filePath) && fs.existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, "Arquivo não encontrado");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  if ([".mp4", ".webm", ".mov"].includes(ext)) {
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const match = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start <= end && end < stat.size) {
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes"
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }
  send(res, 200, fs.readFileSync(filePath), { "Content-Type": type });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    console.log(`${req.method} ${url.pathname}`);
    const request = await nodeToWebRequest(req);
    const response = await handleApi(request);
    await writeWebResponse(res, response);
    return;
  }
  serveFile(req, res);
}

function openBrowser(url) {
  const command = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command);
}

function listen(port) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) send(res, 500, "Erro interno");
    });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < preferredPort + 10) {
      listen(port + 1);
      return;
    }
    console.error("Não foi possível iniciar o servidor:", error.message);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`Site disponível em ${url}`);
    console.log(`Painel: ${url}/admin/login.html`);
    console.log("Pressione Ctrl + C para encerrar.");
    openBrowser(url);
  });
}

ensureLocalEnv();
listen(preferredPort);
