/**
 * Mapa de Itapajé — geometria no cliente, dados no servidor (/api/mapa).
 */
(() => {
  "use strict";

  const TYPES = ["Emenda", "Obra", "Projeto"];
  const STATUSES = ["Entregue", "Em andamento", "Planejado"];
  const REGIONS = ["Todas", "Sede", "Serra", "Zona rural norte", "Zona rural sul", "Distritos"];

  const MAP_W = 440;
  const MAP_H = 400;
  const MAP_PAD = 28;
  const MIN_LON = -39.72;
  const MAX_LON = -39.40;
  const MIN_LAT = -3.875;
  const MAX_LAT = -3.605;
  const VIEW_BOX = `0 0 ${MAP_W} ${MAP_H}`;
  const OUTLINE_PATH = "M124.6 304.6 L128.44 313.9 L145.24 309.44 L156.76 302.95 L185.92 308.93 L196.72 302.05 L198.4 293.26 L238.84 240.13 L244.84 228.03 L273.76 207.52 L304.36 225.74 L299.92 300.91 L307.12 294.41 L317.44 299 L319.6 317.21 L320.2 349.83 L338.92 349.32 L345.76 354.16 L369.4 344.1 L375.52 347.16 L394.24 314.54 L383.44 308.3 L375.76 275.43 L369.04 265.61 L373.24 256.95 L369.16 241.92 L373.24 234.65 L365.32 213.63 L360.88 208.15 L343.96 209.05 L326.32 183.44 L312.88 178.21 L296.92 176.81 L295.48 163.31 L283.6 155.03 L284.32 144.2 L276.4 140.5 L274.48 109.92 L275.08 95.78 L265 92.09 L261.28 97.18 L246.16 95.78 L240.88 91.45 L223.12 86.99 L223.48 73.1 L211.6 59.85 L196.96 56.28 L176.32 55.52 L159.64 63.42 L156.4 75.4 L123.76 67.11 L106.48 85.97 L94 78.45 L78.64 80.24 L68.2 68.52 L60.52 52.84 L61.48 42.27 L49.96 44.18 L55.96 72.72 L53.2 92.47 L43.48 119.73 L43.12 135.15 L57.04 147.64 L64.12 167.38 L69.64 195.41 L69.4 208.28 L82.6 225.74 L101.68 231.47 L108.04 242.94 L110.2 269.05 L118.72 285.49 L124.6 304.6 Z";

  function project(lon, lat) {
    const x = MAP_PAD + ((Number(lon) - MIN_LON) / (MAX_LON - MIN_LON)) * (MAP_W - MAP_PAD * 2);
    const y = MAP_PAD + ((MAX_LAT - Number(lat)) / (MAX_LAT - MIN_LAT)) * (MAP_H - MAP_PAD * 2);
    return { x, y };
  }

  function unproject(x, y) {
    const lon = MIN_LON + ((Number(x) - MAP_PAD) / (MAP_W - MAP_PAD * 2)) * (MAX_LON - MIN_LON);
    const lat = MAX_LAT - ((Number(y) - MAP_PAD) / (MAP_H - MAP_PAD * 2)) * (MAX_LAT - MIN_LAT);
    return {
      lon: Math.min(MAX_LON, Math.max(MIN_LON, lon)),
      lat: Math.min(MAX_LAT, Math.max(MIN_LAT, lat))
    };
  }

  const TITLE = project(-39.561, -3.738);
  let cache = { locations: [], deliveries: [] };

  function createId() {
    return window.crypto?.randomUUID?.() || `mapa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emit(state) {
    cache = state;
    window.dispatchEvent(new CustomEvent("yuriMapaAtualizado", { detail: state }));
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o mapa.");
    return data;
  }

  function loadMapState() {
    return cache;
  }

  async function refreshMapState() {
    const state = await api("/api/mapa");
    emit({
      locations: Array.isArray(state.locations) ? state.locations : [],
      deliveries: Array.isArray(state.deliveries) ? state.deliveries : []
    });
    return cache;
  }

  async function saveMapState(state) {
    const saved = await api("/api/mapa", { method: "PUT", body: JSON.stringify(state) });
    emit(saved);
    return true;
  }

  function formatCurrency(value) {
    const amount = Number(value) || 0;
    if (!amount) return "Valor a informar";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(amount);
  }

  function youtubeId(url = "") {
    const match = String(url).trim().match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : "";
  }

  function normalizeLocation(raw = {}) {
    return {
      id: String(raw.id || createId()),
      name: String(raw.name || "").trim(),
      region: REGIONS.includes(raw.region) && raw.region !== "Todas" ? raw.region : "Sede",
      lon: Number(raw.lon),
      lat: Number(raw.lat),
      labelDx: Number(raw.labelDx) || 0,
      labelDy: Number(raw.labelDy) || 0,
      visible: raw.visible !== false
    };
  }

  function normalizeDelivery(raw = {}) {
    return {
      id: String(raw.id || createId()),
      locationId: String(raw.locationId || ""),
      type: TYPES.includes(raw.type) ? raw.type : "Projeto",
      title: String(raw.title || "").trim(),
      summary: String(raw.summary || "").trim(),
      value: Number(raw.value) || 0,
      status: STATUSES.includes(raw.status) ? raw.status : "Planejado",
      date: String(raw.date || "").slice(0, 10),
      image: String(raw.image || "").trim(),
      video: String(raw.video || "").trim(),
      photos: Array.isArray(raw.photos) ? raw.photos.map((item) => String(item).trim()).filter(Boolean) : [],
      demo: raw.demo !== false
    };
  }

  async function upsertLocation(payload) {
    const item = normalizeLocation(payload);
    const saved = await api("/api/mapa/location", { method: "POST", body: JSON.stringify(item) });
    emit({ locations: saved.locations, deliveries: saved.deliveries });
    return item;
  }

  async function removeLocation(id) {
    const saved = await api(`/api/mapa/location?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    emit(saved);
  }

  async function upsertDelivery(payload) {
    const item = normalizeDelivery(payload);
    const saved = await api("/api/mapa/delivery", { method: "POST", body: JSON.stringify(item) });
    emit({ locations: saved.locations, deliveries: saved.deliveries });
    return item;
  }

  async function removeDelivery(id) {
    const saved = await api(`/api/mapa/delivery?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    emit(saved);
  }

  async function resetMapState() {
    const saved = await api("/api/mapa/reset", { method: "POST", body: "{}" });
    emit(saved);
    return saved;
  }

  const ready = refreshMapState().catch((error) => {
    console.warn("Mapa: usando estado vazio até o servidor responder.", error);
    return cache;
  });

  window.YuriMapa = {
    TYPES, STATUSES, REGIONS, VIEW_BOX, OUTLINE_PATH,
    TITLE_X: TITLE.x, TITLE_Y: TITLE.y, MAP_W, MAP_H,
    project, unproject,
    createId, loadMapState, saveMapState, refreshMapState, formatCurrency, youtubeId,
    normalizeLocation, normalizeDelivery, upsertLocation, removeLocation,
    upsertDelivery, removeDelivery, resetMapState, ready
  };
})();
