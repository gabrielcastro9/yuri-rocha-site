import {
  authConfigured,
  createSessionToken,
  readSession,
  continueSession,
  sessionCookie,
  verifyCredentials
} from "./auth.mjs";
import {
  deleteArticle,
  deleteDelivery,
  deleteLocation,
  deleteMessage,
  insertMessage,
  loadArticles,
  loadSobre,
  loadMap,
  loadMessages,
  normalizeArticle,
  normalizeDelivery,
  normalizeLocation,
  resetMap,
  saveMap,
  saveSobre,
  upsertArticle,
  upsertDelivery,
  upsertLocation
} from "./cms.mjs";
import { dbLabel } from "./db.mjs";
import { error, json, readJson, sameOrigin } from "./http.mjs";
import { saveUpload, storageDriver, storageReady } from "./store.mjs";

function pathOf(request) {
  return new URL(request.url).pathname.replace(/\/+$/, "") || "/";
}

function query(request) {
  return new URL(request.url).searchParams;
}

function requireAuth(request) {
  const session = readSession(request);
  if (!session) return { session: null, response: error("Sessão expirada. Entre novamente.", 401) };
  return { session };
}

function requireOrigin(request) {
  if (!sameOrigin(request)) return error("Origem não permitida.", 403);
  return null;
}

async function withStore(fn) {
  if (!storageReady()) {
    return error("Falta o banco de dados. Na Vercel, crie um Neon Postgres e defina DATABASE_URL.", 503);
  }
  return fn();
}

async function routeApi(request) {
  try {
    const method = request.method.toUpperCase();
    const pathname = pathOf(request);

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    if (pathname === "/api/session" && method === "GET") {
      const session = readSession(request);
      if (!session) return error("Não autenticado.", 401);
      return json({ user: session.user, storage: dbLabel() });
    }

    if (pathname === "/api/login" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const body = await readJson(request);
      const result = verifyCredentials(body.username, body.password, request);
      if (!result.ok) return error(result.error, result.status);
      const token = createSessionToken(result.user);
      return json(
        { user: result.user, storage: dbLabel() },
        200,
        { "Set-Cookie": sessionCookie(token, request) }
      );
    }

    if (pathname === "/api/logout" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", request, true) });
    }

    if (pathname === "/api/sobre" && method === "GET") {
      return withStore(async () => json({ page: await loadSobre() }));
    }

    if (pathname === "/api/sobre" && method === "PUT") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const body = await readJson(request);
        return json({ page: await saveSobre(body.page || body) });
      });
    }

    if (pathname === "/api/noticias" && method === "GET") {
      return withStore(async () => {
        const articles = await loadArticles();
        const session = readSession(request);
        const visible = session ? articles : articles.filter((item) => item.status === "Publicado");
        return json({ articles: visible });
      });
    }

    if (pathname === "/api/noticias" && (method === "POST" || method === "PUT")) {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const body = await readJson(request);
        const article = normalizeArticle(body.article || body);
        if (!article.titulo || !article.slug || !article.resumo || !article.conteudo) {
          return error("Preencha título, slug, resumo e conteúdo.");
        }
        try {
          await upsertArticle(article);
        } catch (err) {
          if (err.code === "SLUG") return error(err.message);
          throw err;
        }
        return json({ article, articles: await loadArticles() });
      });
    }

    if (pathname === "/api/noticias" && method === "DELETE") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const id = query(request).get("id");
        if (!id) return error("Informe o id da notícia.");
        await deleteArticle(id);
        return json({ ok: true, articles: await loadArticles() });
      });
    }

    if (pathname === "/api/mapa" && method === "GET") {
      return withStore(async () => json(await loadMap()));
    }

    if (pathname === "/api/mapa" && method === "PUT") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const body = await readJson(request);
        return json(await saveMap(body));
      });
    }

    if (pathname === "/api/mapa/reset" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => json(await resetMap()));
    }

    if (pathname === "/api/mapa/location" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const body = await readJson(request);
        const item = normalizeLocation(body);
        if (!item.name) return error("Informe o nome da comunidade.");
        await upsertLocation(item);
        const state = await loadMap();
        return json({ item, ...state });
      });
    }

    if (pathname === "/api/mapa/location" && method === "DELETE") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const id = query(request).get("id");
        if (!id) return error("Informe o id do ponto.");
        await deleteLocation(id);
        return json(await loadMap());
      });
    }

    if (pathname === "/api/mapa/delivery" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const body = await readJson(request);
        const item = normalizeDelivery(body);
        if (!item.title || !item.locationId || !item.summary) {
          return error("Preencha título, comunidade e resumo.");
        }
        await upsertDelivery(item);
        const state = await loadMap();
        return json({ item, ...state });
      });
    }

    if (pathname === "/api/mapa/delivery" && method === "DELETE") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const id = query(request).get("id");
        if (!id) return error("Informe o id da entrega.");
        await deleteDelivery(id);
        return json(await loadMap());
      });
    }

    if (pathname === "/api/ouvidoria" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      return withStore(async () => {
        const body = await readJson(request);
        if (String(body.empresa || body.website || "").trim()) {
          return json({ ok: true, protocol: `YFR-${Date.now().toString().slice(-8)}` });
        }
        const email = String(body.email || "").trim();
        if (!body.nome || !email || !body.tipo || !body.assunto || !body.mensagem) {
          return error("Preencha os campos obrigatórios.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("Informe um e-mail válido.");
        const item = await insertMessage({
          ...body,
          protocol: `YFR-${Date.now().toString().slice(-8)}`,
          status: "Recebido"
        });
        return json({ ok: true, protocol: item.protocol });
      });
    }

    if (pathname === "/api/ouvidoria" && method === "GET") {
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => json({ messages: await loadMessages() }));
    }

    if (pathname === "/api/ouvidoria" && method === "DELETE") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      return withStore(async () => {
        const id = query(request).get("id");
        if (!id) return error("Informe o id da manifestação.");
        await deleteMessage(id);
        return json({ ok: true, messages: await loadMessages() });
      });
    }

    if (pathname === "/api/upload" && method === "POST") {
      const blocked = requireOrigin(request);
      if (blocked) return blocked;
      const { session, response } = requireAuth(request);
      if (!session) return response;
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") return error("Envie um arquivo.");
      const uploaded = await saveUpload(file);
      return json(uploaded);
    }

    if (pathname === "/api/health" && method === "GET") {
      return json({
        ok: true,
        auth: authConfigured(),
        storage: storageDriver(),
        database: dbLabel()
      });
    }

    return error("Rota não encontrada.", 404);
  } catch (err) {
    console.error("API error:", err);
    const message = process.env.VERCEL
      ? "Não foi possível concluir a operação. Verifique o banco DATABASE_URL e as variáveis de ambiente."
      : (err.message || "Erro interno.");
    return error(message, 500);
  }
}

export async function handleApi(request) {
  return continueSession(request, await routeApi(request));
}
