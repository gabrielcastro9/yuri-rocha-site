import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MAP_SEED } from "./map-seed.mjs";
import { all, get, run, getMeta, setMeta } from "./db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORIES = ["Obras", "Educação", "Saúde", "Infraestrutura", "Desenvolvimento"];
const TYPES = ["Emenda", "Obra", "Projeto"];
const STATUSES = ["Entregue", "Em andamento", "Planejado"];
const REGIONS = ["Sede", "Serra", "Zona rural norte", "Zona rural sul", "Distritos"];

function slugify(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function safeUrl(value = "") {
  return safeImageUrl(value);
}

function safeImageUrl(value = "") {
  const source = String(value).trim();
  if (!source) return "";
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source;
  if (source.startsWith("/uploads/")) return source.split("#")[0];
  try {
    const url = new URL(source, "http://local.invalid");
    const path = url.pathname || "";
    if (/\.(html?|php|js|css|json|xml|txt)(\?|#|$)/i.test(path)) return "";
    if (path.startsWith("/uploads/")) return path + url.search;
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(path)) return url.href;
    if (/unsplash|cloudinary|imgur|googleusercontent|fbcdn|vercel-storage|blob\.vercel/i.test(url.hostname)) {
      return url.href;
    }
    return "";
  } catch {
    return "";
  }
}

function safeHttpUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function safeVideoUrl(value = "") {
  const source = String(value).trim();
  if (!source) return "";
  if (source.startsWith("/uploads/") && /\.(mp4|webm|mov)(\?|#|$)/i.test(source)) return source.split("#")[0];
  return safeHttpUrl(source);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyJson(name) {
  try {
    const raw = fs.readFileSync(path.join(root, "data", `${name}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeArticle(raw = {}) {
  const id = String(raw.id || randomUUID());
  const titulo = String(raw.titulo || raw.title || "").trim();
  const propagandaTipo = raw.propagandaTipo === "video" || raw.propaganda_tipo === "video" ? "video" : "imagem";
  const propagandaRaw = String(raw.propaganda || "").trim();
  return {
    id,
    titulo,
    slug: String(raw.slug || slugify(titulo) || id),
    categoria: CATEGORIES.includes(raw.categoria) ? raw.categoria : "Desenvolvimento",
    data: String(raw.data || todayISO()).slice(0, 10),
    resumo: String(raw.resumo || "").trim(),
    conteudo: String(raw.conteudo || "").trim(),
    conteudo2: String(raw.conteudo2 || raw.texto2 || "").trim(),
    imagem: safeImageUrl(raw.imagem),
    propagandaTipo,
    propaganda: propagandaTipo === "video" ? safeVideoUrl(propagandaRaw) : safeImageUrl(propagandaRaw),
    galeria: Array.isArray(raw.galeria) ? [...new Set(raw.galeria.map(safeImageUrl).filter(Boolean))].slice(0, 8) : [],
    status: raw.status === "Publicado" ? "Publicado" : "Rascunho",
    criadoEm: raw.criadoEm || raw.criado_em || new Date().toISOString(),
    atualizadoEm: raw.atualizadoEm || raw.atualizado_em || new Date().toISOString()
  };
}

function articleFromRow(row) {
  return normalizeArticle({
    id: row.id,
    titulo: row.titulo,
    slug: row.slug,
    categoria: row.categoria,
    data: row.data,
    resumo: row.resumo,
    conteudo: row.conteudo,
    conteudo2: row.conteudo2,
    imagem: row.imagem,
    propaganda: row.propaganda,
    propagandaTipo: row.propaganda_tipo,
    galeria: parseJsonArray(row.galeria),
    status: row.status,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  });
}

export function normalizeLocation(raw = {}) {
  return {
    id: String(raw.id || randomUUID()),
    name: String(raw.name || "").trim(),
    region: REGIONS.includes(raw.region) ? raw.region : "Sede",
    lon: Number(raw.lon),
    lat: Number(raw.lat),
    labelDx: Number(raw.labelDx ?? raw.label_dx) || 0,
    labelDy: Number(raw.labelDy ?? raw.label_dy) || 0,
    visible: raw.visible !== false && raw.visible !== 0
  };
}

export function normalizeDelivery(raw = {}) {
  return {
    id: String(raw.id || randomUUID()),
    locationId: String(raw.locationId || raw.location_id || ""),
    type: TYPES.includes(raw.type) ? raw.type : "Projeto",
    title: String(raw.title || "").trim(),
    summary: String(raw.summary || "").trim(),
    value: Number(raw.value) || 0,
    status: STATUSES.includes(raw.status) ? raw.status : "Planejado",
    date: String(raw.date || "").slice(0, 10),
    image: safeUrl(raw.image),
    video: String(raw.video || "").trim(),
    photos: Array.isArray(raw.photos) ? raw.photos.map(safeUrl).filter(Boolean) : parseJsonArray(raw.photos),
    demo: raw.demo !== false && raw.demo !== 0
  };
}

function locationFromRow(row) {
  return normalizeLocation({
    id: row.id,
    name: row.name,
    region: row.region,
    lon: row.lon,
    lat: row.lat,
    labelDx: row.label_dx,
    labelDy: row.label_dy,
    visible: row.visible
  });
}

function deliveryFromRow(row) {
  return normalizeDelivery({
    id: row.id,
    locationId: row.location_id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    value: row.value,
    status: row.status,
    date: row.date,
    image: row.image,
    video: row.video,
    photos: row.photos,
    demo: row.demo
  });
}

function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeMessage(raw = {}) {
  return {
    id: String(raw.id || randomUUID()),
    protocol: String(raw.protocol || `YFR-${Date.now().toString().slice(-8)}`),
    nome: cleanText(raw.nome, 120),
    email: cleanText(raw.email, 160),
    bairro: cleanText(raw.bairro, 80),
    tipo: cleanText(raw.tipo, 40),
    assunto: cleanText(raw.assunto, 120),
    mensagem: cleanText(raw.mensagem, 2000),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    status: raw.status || "Recebido"
  };
}

function messageFromRow(row) {
  return normalizeMessage({
    id: row.id,
    protocol: row.protocol,
    nome: row.nome,
    email: row.email,
    bairro: row.bairro,
    tipo: row.tipo,
    assunto: row.assunto,
    mensagem: row.mensagem,
    createdAt: row.created_at,
    status: row.status
  });
}

async function seedIfNeeded() {
  if (await getMeta("db_ready")) return;

  const articleCount = (await get("SELECT COUNT(*) AS total FROM articles"))?.total || 0;
  if (!Number(articleCount)) {
    const legacyNews = readLegacyJson("noticias");
    if (Array.isArray(legacyNews) && legacyNews.length) {
      for (const item of legacyNews) await upsertArticle(normalizeArticle(item), { skipDuplicateCheck: true });
    }
  }

  const locationCount = (await get("SELECT COUNT(*) AS total FROM map_locations"))?.total || 0;
  if (!Number(locationCount)) {
    const legacyMap = readLegacyJson("mapa");
    const source = legacyMap?.locations?.length ? legacyMap : MAP_SEED;
    for (const item of source.locations || []) await upsertLocation(normalizeLocation(item));
    for (const item of source.deliveries || []) await upsertDelivery(normalizeDelivery(item));
  }

  const messageCount = (await get("SELECT COUNT(*) AS total FROM ouvidoria"))?.total || 0;
  if (!Number(messageCount)) {
    const legacyMessages = readLegacyJson("ouvidoria");
    if (Array.isArray(legacyMessages) && legacyMessages.length) {
      for (const item of legacyMessages) await insertMessage(normalizeMessage(item));
    }
  }

  await setMeta("db_ready", "1");
}

export async function loadArticles() {
  await seedIfNeeded();
  const rows = await all("SELECT * FROM articles ORDER BY data DESC, atualizado_em DESC");
  return rows.map(articleFromRow);
}

export async function getArticleById(id) {
  const row = await get("SELECT * FROM articles WHERE id = ?", [id]);
  return row ? articleFromRow(row) : null;
}

export async function upsertArticle(raw, options = {}) {
  const article = normalizeArticle(raw);
  const previous = await getArticleById(article.id);
  article.criadoEm = previous?.criadoEm || article.criadoEm || new Date().toISOString();
  article.atualizadoEm = new Date().toISOString();

  if (!options.skipDuplicateCheck) {
    const duplicate = await get("SELECT id FROM articles WHERE slug = ? AND id != ?", [article.slug, article.id]);
    if (duplicate) {
      const error = new Error("Este slug já pertence a outra notícia.");
      error.code = "SLUG";
      throw error;
    }
  }

  const propaganda = article.propagandaTipo === "video"
    ? safeVideoUrl(article.propaganda)
    : safeImageUrl(article.propaganda);

  await run(
    `INSERT INTO articles (id, titulo, slug, categoria, data, resumo, conteudo, conteudo2, imagem, propaganda, propaganda_tipo, galeria, status, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       titulo = excluded.titulo,
       slug = excluded.slug,
       categoria = excluded.categoria,
       data = excluded.data,
       resumo = excluded.resumo,
       conteudo = excluded.conteudo,
       conteudo2 = excluded.conteudo2,
       imagem = excluded.imagem,
       propaganda = excluded.propaganda,
       propaganda_tipo = excluded.propaganda_tipo,
       galeria = excluded.galeria,
       status = excluded.status,
       atualizado_em = excluded.atualizado_em`,
    [
      article.id, article.titulo, article.slug, article.categoria, article.data,
      article.resumo, article.conteudo, article.conteudo2, article.imagem, propaganda,
      article.propagandaTipo, JSON.stringify(article.galeria),
      article.status, article.criadoEm, article.atualizadoEm
    ]
  );
  return article;
}

const SOBRE_ICONS = ["infra", "saude", "desenvolvimento"];

export const DEFAULT_SOBRE = {
  heroEyebrow: "Vereador de Itapajé",
  heroTitle: "Engenheiro civil. Vereador da cidade.",
  heroLead: "Eleito em 2024 pelo UNIÃO Brasil, Yuri Farias Rocha exerce o primeiro mandato com formação em engenharia civil, segurança do trabalho e gestão pública.",
  photo: "https://commons.wikimedia.org/wiki/Special:FilePath/Serras%20no%20entorno%20de%20Itapaj%C3%A9%20-%20CE.%20-%20panoramio.jpg?width=1000",
  photoAlt: "Serras no entorno de Itapajé; fotografia oficial de Yuri será inserida posteriormente",
  photoCaption: "Itapajé, Ceará",
  journeyEyebrow: "A trajetória",
  journeyTitle: "Da engenharia à *Câmara* de Itapajé",
  journeyLead: "Yuri Farias Rocha nasceu em 29 de junho de 1998. É engenheiro civil, engenheiro de segurança do trabalho e empreendedor, com MBA em Gestão de Políticas Públicas. Em 2024, a cidade o elegeu vereador pelo UNIÃO Brasil, no primeiro mandato.",
  facts: [
    { value: "29 jun 1998", label: "Nascimento" },
    { value: "UNIÃO Brasil", label: "Eleito em 2024" },
    { value: "1º mandato", label: "Câmara de Itapajé" }
  ],
  steps: [
    { kicker: "Formação", title: "Engenharia civil", text: "A base para ler obra, planejamento e os desafios urbanos de Itapajé com critério técnico." },
    { kicker: "Especialização", title: "Segurança e gestão", text: "Engenheiro de segurança do trabalho e MBA em Gestão de Políticas Públicas." },
    { kicker: "Experiência", title: "Empreendedorismo", text: "A prática de quem gere, decide e conhece o esforço de fazer a economia local andar." },
    { kicker: "2024", title: "Vereador de Itapajé", text: "Primeiro mandato pelo UNIÃO Brasil: propor, fiscalizar e cobrar na Câmara Municipal." }
  ],
  mandateEyebrow: "O vereador de Itapajé",
  mandateTitle: "Propor, fiscalizar e cobrar",
  mandateLead: "Na Câmara, o mandato transforma a escuta da cidade em projeto de lei, discurso e cobrança por obra, saúde, educação e desenvolvimento.",
  fronts: [
    { icon: "infra", title: "Infraestrutura", text: "Acompanhar as obras de Itapajé e cobrar, na Câmara, pavimentação, iluminação, drenagem e espaços públicos com planejamento e fiscalização." },
    { icon: "saude", title: "Saúde e Educação", text: "Defender, em projeto e em discurso, postos de saúde mais próximos e escolas que formem os jovens de Itapajé." },
    { icon: "desenvolvimento", title: "Desenvolvimento", text: "Levar à Câmara a voz de quem empreende e trabalha em Itapajé, para o município gerar mais emprego e renda." }
  ]
};

function clipText(value, max) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function listOf(value, mapItem, limit) {
  if (!Array.isArray(value)) return [];
  return value.map(mapItem).filter(Boolean).slice(0, limit);
}

export function normalizeSobre(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    heroEyebrow: clipText(source.heroEyebrow, 80),
    heroTitle: clipText(source.heroTitle, 160),
    heroLead: clipText(source.heroLead, 500),
    photo: safeImageUrl(source.photo),
    photoAlt: clipText(source.photoAlt, 180),
    photoCaption: clipText(source.photoCaption, 80),
    journeyEyebrow: clipText(source.journeyEyebrow, 80),
    journeyTitle: clipText(source.journeyTitle, 180),
    journeyLead: clipText(source.journeyLead, 900),
    facts: listOf(source.facts, (item) => {
      const value = clipText(item?.value, 80);
      const label = clipText(item?.label, 80);
      return value || label ? { value, label } : null;
    }, 8),
    steps: listOf(source.steps, (item) => {
      const kicker = clipText(item?.kicker, 40);
      const title = clipText(item?.title, 80);
      const text = clipText(item?.text, 400);
      return kicker || title || text ? { kicker, title, text } : null;
    }, 8),
    mandateEyebrow: clipText(source.mandateEyebrow, 80),
    mandateTitle: clipText(source.mandateTitle, 160),
    mandateLead: clipText(source.mandateLead, 500),
    fronts: listOf(source.fronts, (item) => {
      const title = clipText(item?.title, 80);
      const text = clipText(item?.text, 400);
      const icon = SOBRE_ICONS.includes(item?.icon) ? item.icon : "infra";
      return title || text ? { icon, title, text } : null;
    }, 6)
  };
}

export async function loadSobre() {
  await seedIfNeeded();
  const stored = await getMeta("sobre");
  if (!stored) return normalizeSobre(DEFAULT_SOBRE);
  try {
    return normalizeSobre(JSON.parse(stored));
  } catch {
    return normalizeSobre(DEFAULT_SOBRE);
  }
}

export async function saveSobre(raw) {
  const page = normalizeSobre(raw);
  await setMeta("sobre", JSON.stringify(page));
  return page;
}

export async function deleteArticle(id) {
  await run("DELETE FROM articles WHERE id = ?", [id]);
}

export async function loadMap() {
  await seedIfNeeded();
  const locations = (await all("SELECT * FROM map_locations ORDER BY name")).map(locationFromRow);
  const deliveries = (await all("SELECT * FROM map_deliveries ORDER BY date DESC, title")).map(deliveryFromRow);
  return { locations, deliveries };
}

export async function upsertLocation(raw) {
  const item = normalizeLocation(raw);
  await run(
    `INSERT INTO map_locations (id, name, region, lon, lat, label_dx, label_dy, visible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       region = excluded.region,
       lon = excluded.lon,
       lat = excluded.lat,
       label_dx = excluded.label_dx,
       label_dy = excluded.label_dy,
       visible = excluded.visible`,
    [item.id, item.name, item.region, item.lon, item.lat, item.labelDx, item.labelDy, item.visible ? 1 : 0]
  );
  return item;
}

export async function deleteLocation(id) {
  await run("DELETE FROM map_deliveries WHERE location_id = ?", [id]);
  await run("DELETE FROM map_locations WHERE id = ?", [id]);
}

export async function upsertDelivery(raw) {
  const item = normalizeDelivery(raw);
  await run(
    `INSERT INTO map_deliveries (id, location_id, type, title, summary, value, status, date, image, video, photos, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       location_id = excluded.location_id,
       type = excluded.type,
       title = excluded.title,
       summary = excluded.summary,
       value = excluded.value,
       status = excluded.status,
       date = excluded.date,
       image = excluded.image,
       video = excluded.video,
       photos = excluded.photos,
       demo = excluded.demo`,
    [
      item.id, item.locationId, item.type, item.title, item.summary, item.value,
      item.status, item.date, item.image, item.video, JSON.stringify(item.photos), item.demo ? 1 : 0
    ]
  );
  return item;
}

export async function deleteDelivery(id) {
  await run("DELETE FROM map_deliveries WHERE id = ?", [id]);
}

export async function saveMap(state) {
  const nextLocations = (state.locations || []).map(normalizeLocation);
  const nextDeliveries = (state.deliveries || []).map(normalizeDelivery);
  const keepLocations = nextLocations.map((item) => item.id);
  const keepDeliveries = nextDeliveries.map((item) => item.id);

  for (const item of nextLocations) await upsertLocation(item);
  for (const item of nextDeliveries) await upsertDelivery(item);

  const current = await loadMap();
  for (const item of current.deliveries) {
    if (!keepDeliveries.includes(item.id)) await deleteDelivery(item.id);
  }
  for (const item of current.locations) {
    if (!keepLocations.includes(item.id)) await deleteLocation(item.id);
  }
  return loadMap();
}

export async function resetMap() {
  await run("DELETE FROM map_deliveries");
  await run("DELETE FROM map_locations");
  for (const item of MAP_SEED.locations) await upsertLocation(item);
  for (const item of MAP_SEED.deliveries) await upsertDelivery(item);
  return loadMap();
}

export async function loadMessages() {
  await seedIfNeeded();
  const rows = await all("SELECT * FROM ouvidoria ORDER BY created_at DESC");
  return rows.map(messageFromRow);
}

export async function insertMessage(raw) {
  const item = normalizeMessage(raw);
  await run(
    `INSERT INTO ouvidoria (id, protocol, nome, email, bairro, tipo, assunto, mensagem, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.id, item.protocol, item.nome, item.email, item.bairro, item.tipo, item.assunto, item.mensagem, item.createdAt, item.status]
  );
  return item;
}

export async function deleteMessage(id) {
  await run("DELETE FROM ouvidoria WHERE id = ?", [id]);
}
