(() => {
  "use strict";

  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
  const MAX_GALLERY_FILES = 8;
  const CATEGORIES = ["Obras", "Educação", "Saúde", "Infraestrutura", "Desenvolvimento"];
  const page = document.body?.dataset.adminPage;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHTML(value = "") {
    return (window.YuriAdmin?.escapeHTML || ((text) => String(text).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]))))(value);
  }

  function api(path, options) {
    return window.YuriAdmin.api(path, options);
  }

  function safeImageSource(value = "") {
    const source = String(value).trim();
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source;
    if (source.startsWith("/uploads/")) return source.split("#")[0];
    try {
      const url = new URL(source, window.location.href);
      const path = url.pathname || "";
      if (/\.(html?|php|js|css|json)(\?|#|$)/i.test(path)) return "";
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

  function hostedImage(src = "") {
    return /^data:image\//.test(src) || src.startsWith("/uploads/") || src.includes("blob.vercel-storage.com");
  }

  function slugify(value = "") {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function formatDate(value) {
    if (!value) return "—";
    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return "—";
    return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
  }

  function todayISO() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function createId() {
    return window.crypto?.randomUUID?.() || `noticia-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeArticle(raw = {}) {
    const id = String(raw.id || createId());
    const titulo = String(raw.titulo || raw.title || "");
    return {
      id,
      titulo,
      slug: String(raw.slug || raw.identificador || slugify(titulo) || id),
      categoria: CATEGORIES.includes(raw.categoria) ? raw.categoria : "Desenvolvimento",
      data: String(raw.data || todayISO()).slice(0, 10),
      resumo: String(raw.resumo || raw.summary || ""),
      conteudo: String(raw.conteudo || raw.content || ""),
      conteudo2: String(raw.conteudo2 || raw.texto2 || ""),
      imagem: safeImageSource(raw.imagem || raw.imagemCapa || raw.coverImage || ""),
      propagandaTipo: raw.propagandaTipo === "video" || raw.propaganda_tipo === "video" ? "video" : "imagem",
      propaganda: (raw.propagandaTipo === "video" || raw.propaganda_tipo === "video")
        ? String(raw.propaganda || "").trim()
        : safeImageSource(raw.propaganda || ""),
      galeria: Array.isArray(raw.galeria) ? [...new Set(raw.galeria.map(safeImageSource).filter(Boolean))] : [],
      status: raw.status === "Publicado" ? "Publicado" : "Rascunho",
      criadoEm: raw.criadoEm || new Date().toISOString(),
      atualizadoEm: raw.atualizadoEm || raw.criadoEm || new Date().toISOString()
    };
  }

  function showMessage(element, text, type = "success", focus = false) {
    if (!element) return;
    element.textContent = text;
    element.className = element.id === "global-message" ? `message toast-message ${type}` : `message ${type}`;
    element.hidden = false;
    if (focus) {
      element.tabIndex = -1;
      element.focus();
    }
  }

  function notifyFactory() {
    const element = $("#global-message");
    let timer = null;
    return (text, type = "success") => {
      window.clearTimeout(timer);
      showMessage(element, text, type);
      timer = window.setTimeout(() => { if (element) element.hidden = true; }, 5000);
    };
  }

  function markdownToHTML(source = "") {
    let html = escapeHTML(source).replace(/\r\n?/g, "\n");
    html = html
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>");
    return `<p>${html || "O conteúdo aparecerá aqui."}</p>`;
  }

  function articlePreviewHTML(article, compact = false) {
    const image = safeImageSource(article.imagem);
    const gallery = article.galeria.map(safeImageSource).filter(Boolean);
    const adImage = article.propagandaTipo === "imagem" ? safeImageSource(article.propaganda) : "";
    const adVideo = article.propagandaTipo === "video" ? article.propaganda : "";
    const adFile = /\.(mp4|webm|mov)(\?|#|$)/i.test(adVideo);
    if (compact) {
      return `
        ${image ? `<img class="preview-cover" src="${escapeHTML(image)}" alt="">` : '<div class="preview-cover preview-cover-placeholder" aria-hidden="true">Sem capa</div>'}
        <div class="preview-body">
          <span class="badge ${article.status === "Publicado" ? "badge-published" : "badge-draft"}">${escapeHTML(article.status)}</span>
          <h3>${escapeHTML(article.titulo || "Título da notícia")}</h3>
          <p>${escapeHTML(article.conteudo || "O texto inicial aparece aqui.")}</p>
          <ul class="preview-checklist">
            <li>${image ? "Capa pronta" : "Capa vazia"}</li>
            <li>${article.conteudo.trim() ? "Texto inicial pronto" : "Falta o texto inicial"}</li>
            <li>${adImage || adVideo ? "Propaganda pronta" : "Propaganda vazia — não vai ao site"}</li>
            <li>${gallery.length ? `Carrossel com ${gallery.length} foto${gallery.length > 1 ? "s" : ""}` : "Carrossel vazio — não vai ao site"}</li>
            <li>${article.conteudo2.trim() ? "Texto final pronto" : "Texto final vazio — não vai ao site"}</li>
          </ul>
          <small>${escapeHTML(article.categoria || "Categoria")} · ${formatDate(article.data)}</small>
        </div>`;
    }
    return `
      <p class="eyebrow">${escapeHTML(article.categoria || "Categoria")} · ${formatDate(article.data)}</p>
      <h1>${escapeHTML(article.titulo || "Título da notícia")}</h1>
      ${image ? `<img class="hero-image" src="${escapeHTML(image)}" alt="Imagem de capa de ${escapeHTML(article.titulo)}">` : "<p class=\"muted\">Sem imagem de capa.</p>"}
      <div class="article-content">${markdownToHTML(article.conteudo)}</div>
      ${adImage ? `<figure class="preview-ad"><img src="${escapeHTML(adImage)}" alt="Propaganda da notícia"></figure>` : ""}
      ${adFile ? `<video class="preview-video" src="${escapeHTML(adVideo)}" controls playsinline></video>` : ""}
      ${adVideo && !adFile ? `<p class="muted">Propaganda em vídeo: ${escapeHTML(adVideo)}</p>` : ""}
      ${!adImage && !adVideo ? "<p class=\"muted\">Sem propaganda neste artigo.</p>" : ""}
      ${gallery.length ? `<div class="article-gallery">${gallery.map((src, index) => `<img src="${escapeHTML(src)}" alt="Galeria de ${escapeHTML(article.titulo)}, imagem ${index + 1}">`).join("")}</div>` : "<p class=\"muted\">Sem carrossel neste artigo.</p>"}
      ${article.conteudo2 ? `<div class="article-content">${markdownToHTML(article.conteudo2)}</div>` : "<p class=\"muted\">Sem texto final neste artigo.</p>"}`;
  }

  function initLogin() {
    const form = $("#login-form");
    const message = $("#auth-message");
    const username = $("#username");
    const password = $("#password");
    const toggle = $("[data-toggle-password]");

    fetch("/api/session", { credentials: "include" }).then((res) => {
      if (res.ok) window.location.replace("dashboard.html");
    }).catch(() => {});

    toggle?.addEventListener("click", () => {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      toggle.setAttribute("aria-pressed", String(!visible));
      toggle.setAttribute("aria-label", visible ? "Mostrar senha" : "Ocultar senha");
      password.focus();
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      [username, password].forEach((input) => input.removeAttribute("aria-invalid"));
      if (!username.value.trim() || !password.value) {
        if (!username.value.trim()) username.setAttribute("aria-invalid", "true");
        if (!password.value) password.setAttribute("aria-invalid", "true");
        showMessage(message, "Preencha usuário e senha para continuar.", "error", true);
        (!username.value.trim() ? username : password).focus();
        return;
      }
      const submit = form.querySelector("[type='submit']");
      submit.disabled = true;
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.value.trim(), password: password.value })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
        showMessage(message, "Acesso autorizado. Abrindo o painel…", "success");
        window.location.assign("dashboard.html");
      } catch (error) {
        username.setAttribute("aria-invalid", "true");
        password.setAttribute("aria-invalid", "true");
        showMessage(message, error.message, "error", true);
        password.select();
      } finally {
        submit.disabled = false;
      }
    });
  }

  async function initOverview() {
    const notify = notifyFactory();
    const today = $("#overview-date");
    if (today) {
      today.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    }

    try {
      const [newsData, mapData, ouviData] = await Promise.all([
        api("/api/noticias"),
        api("/api/mapa"),
        api("/api/ouvidoria")
      ]);
      const articles = (newsData.articles || []).map(normalizeArticle);
      const published = articles.filter((item) => item.status === "Publicado");
      const drafts = articles.filter((item) => item.status === "Rascunho");
      const locations = mapData.locations || [];
      const deliveries = mapData.deliveries || [];
      const messages = ouviData.messages || [];
      const latest = [...articles].sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm))[0];

      $("#metric-total").textContent = String(articles.length);
      $("#metric-published").textContent = String(published.length);
      $("#metric-drafts").textContent = String(drafts.length);
      $("#metric-ouvidoria").textContent = String(messages.length);
      $("#metric-map").textContent = String(locations.length);
      $("#metric-deliveries").textContent = String(deliveries.length);
      $("#metric-latest").textContent = latest ? formatDate(latest.data) : "—";

      const newsList = $("#overview-news");
      if (newsList) {
        newsList.setAttribute("aria-busy", "false");
        const recent = [...articles].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 4);
        newsList.innerHTML = recent.length ? recent.map((article) => {
          const image = safeImageSource(article.imagem);
          return `<a class="feed-item" href="noticia.html?id=${encodeURIComponent(article.id)}">
            ${image ? `<img src="${escapeHTML(image)}" alt="">` : `<span class="feed-thumb" aria-hidden="true">▤</span>`}
            <span>
              <strong>${escapeHTML(article.titulo)}</strong>
              <small>${escapeHTML(article.categoria)} · ${formatDate(article.data)} · ${escapeHTML(article.status)}</small>
            </span>
          </a>`;
        }).join("") : `<p class="empty-copy">Ainda não há notícias. <a href="noticia.html">Escreva a primeira</a>.</p>`;
      }

      const inbox = $("#overview-ouvidoria");
      if (inbox) {
        inbox.innerHTML = messages.slice(0, 4).length ? messages.slice(0, 4).map((item) => `
          <a class="feed-item" href="ouvidoria.html">
            <span class="feed-thumb" aria-hidden="true">✉</span>
            <span>
              <strong>${escapeHTML(item.assunto)}</strong>
              <small>${escapeHTML(item.nome)} · ${escapeHTML(item.tipo)} · ${formatDate(item.createdAt)}</small>
            </span>
          </a>`).join("") : `<p class="empty-copy">Nenhuma manifestação recebida ainda.</p>`;
      }
    } catch (error) {
      notify(error.message, "error");
    }
  }

  async function initNews() {
    const notify = notifyFactory();
    let articles = [];
    let pendingDeleteId = null;
    const elements = {
      board: $("#news-board"),
      empty: $("#empty-state"),
      search: $("#news-search"),
      statusFilter: $("#status-filter"),
      categoryFilter: $("#category-filter"),
      confirmDialog: $("#confirm-dialog"),
      previewDialog: $("#preview-dialog"),
      dialogPreview: $("#dialog-preview-content"),
      count: $("#news-count")
    };

    async function refresh() {
      const data = await api("/api/noticias");
      articles = (data.articles || []).map(normalizeArticle);
    }

    function render() {
      if (!elements.board) return;
      const query = (elements.search?.value || "").trim().toLocaleLowerCase("pt-BR");
      const status = elements.statusFilter?.value || "";
      const category = elements.categoryFilter?.value || "";
      const filtered = articles
        .filter((article) => !query || [article.titulo, article.resumo, article.categoria].join(" ").toLocaleLowerCase("pt-BR").includes(query))
        .filter((article) => !status || article.status === status)
        .filter((article) => !category || article.categoria === category)
        .sort((a, b) => b.data.localeCompare(a.data));

      if (elements.count) elements.count.textContent = `${filtered.length} publicação(ões)`;
      elements.board.innerHTML = filtered.map((article) => {
        const image = safeImageSource(article.imagem);
        return `<article class="content-card">
          ${image ? `<img class="content-cover" src="${escapeHTML(image)}" alt="">` : `<div class="content-cover content-cover-empty" aria-hidden="true">YR</div>`}
          <div class="content-body">
            <div class="content-meta">
              <span class="category-label">${escapeHTML(article.categoria)}</span>
              <span class="badge ${article.status === "Publicado" ? "badge-published" : "badge-draft"}">${escapeHTML(article.status)}</span>
            </div>
            <h3>${escapeHTML(article.titulo)}</h3>
            <p>${escapeHTML(article.resumo)}</p>
            <small>${formatDate(article.data)}</small>
            <div class="content-actions">
              <button class="button button-secondary" type="button" data-preview-id="${escapeHTML(article.id)}">Prévia</button>
              <button class="button button-secondary" type="button" data-toggle-id="${escapeHTML(article.id)}">${article.status === "Publicado" ? "Despublicar" : "Publicar"}</button>
              <a class="button button-primary" href="noticia.html?id=${encodeURIComponent(article.id)}">Editar</a>
              <button class="button button-danger" type="button" data-delete-id="${escapeHTML(article.id)}">Excluir</button>
            </div>
          </div>
        </article>`;
      }).join("");
      if (elements.empty) elements.empty.hidden = filtered.length > 0;
      elements.board.hidden = filtered.length === 0;
    }

    try {
      await refresh();
      render();
    } catch (error) {
      notify(error.message, "error");
    }

    [elements.search, elements.statusFilter, elements.categoryFilter].forEach((input) => input?.addEventListener("input", render));

    elements.board?.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const article = articles.find((item) => item.id === (button.dataset.previewId || button.dataset.toggleId || button.dataset.deleteId));
      if (!article) return;
      if (button.dataset.previewId) {
        elements.dialogPreview.innerHTML = articlePreviewHTML(article);
        elements.previewDialog.showModal();
      }
      if (button.dataset.toggleId) {
        article.status = article.status === "Publicado" ? "Rascunho" : "Publicado";
        try {
          const data = await api("/api/noticias", { method: "POST", body: JSON.stringify({ article }) });
          articles = (data.articles || []).map(normalizeArticle);
          render();
          notify(article.status === "Publicado" ? "Notícia publicada." : "Notícia movida para rascunho.");
        } catch (error) {
          notify(error.message, "error");
          await refresh();
          render();
        }
      }
      if (button.dataset.deleteId) {
        pendingDeleteId = article.id;
        $("#confirm-title").textContent = `Excluir “${article.titulo}”?`;
        elements.confirmDialog.showModal();
      }
    });

    $("[data-close-preview]")?.addEventListener("click", () => elements.previewDialog.close());
    $("[data-cancel-delete]")?.addEventListener("click", () => { pendingDeleteId = null; elements.confirmDialog.close(); });
    $("[data-confirm-delete]")?.addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      try {
        const data = await api(`/api/noticias?id=${encodeURIComponent(pendingDeleteId)}`, { method: "DELETE" });
        articles = (data.articles || []).map(normalizeArticle);
        render();
        notify("Notícia excluída.");
      } catch (error) {
        notify(error.message, "error");
      }
      pendingDeleteId = null;
      elements.confirmDialog.close();
    });
  }

  async function initEditor() {
    const notify = notifyFactory();
    let uploadedCover = "";
    let uploadedGallery = [];
    let uploadedAd = "";
    let uploadedVideo = "";
    const elements = {
      form: $("#article-form"),
      editorTitle: $("#editor-title"),
      id: $("#article-id"),
      title: $("#article-title"),
      slug: $("#article-slug"),
      category: $("#article-category"),
      date: $("#article-date"),
      status: $("#article-status"),
      summary: $("#article-summary"),
      content: $("#article-content"),
      content2: $("#article-content-2"),
      coverUrl: $("#cover-url"),
      coverUpload: $("#cover-upload"),
      coverInfo: $("#cover-file-info"),
      adType: $("#ad-type"),
      adUrl: $("#ad-url"),
      adUpload: $("#ad-upload"),
      adInfo: $("#ad-file-info"),
      adVideo: $("#ad-video"),
      adVideoUpload: $("#ad-video-upload"),
      adVideoInfo: $("#ad-video-info"),
      adImageFields: $("#ad-image-fields"),
      adVideoFields: $("#ad-video-fields"),
      galleryUrls: $("#gallery-urls"),
      galleryUpload: $("#gallery-upload"),
      galleryList: $("#gallery-file-list"),
      preview: $("#preview-card"),
      dialogPreview: $("#dialog-preview-content"),
      previewDialog: $("#preview-dialog"),
      summaryCount: $("#summary-count"),
      viewSite: $("#view-site")
    };
    if (!elements.form) return;

    function currentFormArticle() {
      const urlGallery = elements.galleryUrls.value.split(/\r?\n|,/).map(safeImageSource).filter(Boolean);
      const videoMode = elements.adType?.value === "video";
      return normalizeArticle({
        id: elements.id.value || createId(),
        titulo: elements.title.value.trim(),
        slug: elements.slug.value.trim(),
        categoria: elements.category.value,
        data: elements.date.value,
        resumo: elements.summary.value.trim(),
        conteudo: elements.content.value,
        conteudo2: elements.content2?.value || "",
        imagem: uploadedCover || elements.coverUrl.value.trim(),
        propagandaTipo: videoMode ? "video" : "imagem",
        propaganda: videoMode
          ? (uploadedVideo || (elements.adVideo?.value || "").trim())
          : (uploadedAd || elements.adUrl?.value.trim() || ""),
        galeria: [...urlGallery, ...uploadedGallery],
        status: elements.status.value
      });
    }

    function syncAdFields() {
      const video = elements.adType?.value === "video";
      if (elements.adImageFields) elements.adImageFields.hidden = video;
      if (elements.adVideoFields) elements.adVideoFields.hidden = !video;
    }

    function publicArticleUrl(article = currentFormArticle()) {
      const slug = article.slug || article.id;
      return slug ? `../noticia.html?id=${encodeURIComponent(slug)}` : "../noticias.html";
    }

    function updatePreview() {
      const article = currentFormArticle();
      elements.preview.innerHTML = articlePreviewHTML(article, true);
      elements.summaryCount.textContent = String(elements.summary.value.length);
      if (elements.viewSite) {
        elements.viewSite.href = publicArticleUrl(article);
        elements.viewSite.hidden = article.status !== "Publicado" || !article.slug;
      }
    }

    function updateFileLists() {
      if (elements.coverInfo) {
        elements.coverInfo.innerHTML = uploadedCover
          ? `<img class="upload-thumb" src="${escapeHTML(uploadedCover)}" alt="Capa enviada"><span>Capa pronta para o site.</span><button type="button" data-clear-cover>Remover</button>`
          : "";
      }
      if (elements.adInfo) {
        elements.adInfo.innerHTML = uploadedAd
          ? `<img class="upload-thumb" src="${escapeHTML(uploadedAd)}" alt="Propaganda enviada"><span>Propaganda pronta para o site.</span><button type="button" data-clear-ad>Remover</button>`
          : "";
      }
      if (elements.adVideoInfo) {
        elements.adVideoInfo.innerHTML = uploadedVideo
          ? `<video class="upload-thumb" src="${escapeHTML(uploadedVideo)}" muted playsinline></video><span>Vídeo pronto para o site.</span><button type="button" data-clear-video>Remover</button>`
          : "";
      }
      if (elements.galleryList) {
        elements.galleryList.innerHTML = uploadedGallery.map((src, index) =>
          `<span class="file-chip file-chip-thumb"><img src="${escapeHTML(src)}" alt=""><span>Imagem ${index + 1}</span><button type="button" data-remove-gallery="${index}" aria-label="Remover imagem ${index + 1}">×</button></span>`
        ).join("");
      }
    }

    function fill(article) {
      elements.form.reset();
      uploadedCover = "";
      uploadedGallery = [];
      uploadedAd = "";
      uploadedVideo = "";
      delete elements.slug.dataset.edited;
      elements.date.value = todayISO();
      elements.status.value = "Rascunho";
      if (elements.adType) elements.adType.value = "imagem";
      if (article) {
        elements.editorTitle.textContent = "Editar notícia";
        const top = $("#topbar-title");
        if (top) top.textContent = "Editar notícia";
        elements.id.value = article.id;
        elements.title.value = article.titulo;
        elements.slug.value = article.slug;
        elements.category.value = article.categoria;
        elements.date.value = article.data;
        elements.status.value = article.status;
        elements.summary.value = article.resumo;
        elements.content.value = article.conteudo;
        if (elements.content2) elements.content2.value = article.conteudo2 || "";
        if (elements.adType) elements.adType.value = article.propagandaTipo || "imagem";
        if (article.imagem && !hostedImage(article.imagem)) elements.coverUrl.value = article.imagem;
        else uploadedCover = article.imagem || "";
        if (article.propagandaTipo === "video") {
          if (/\.(mp4|webm|mov)(\?|#|$)/i.test(article.propaganda || "")) uploadedVideo = article.propaganda;
          else if (elements.adVideo) elements.adVideo.value = article.propaganda || "";
        } else if (article.propaganda && !hostedImage(article.propaganda)) {
          if (elements.adUrl) elements.adUrl.value = article.propaganda;
        } else {
          uploadedAd = article.propaganda || "";
        }
        uploadedGallery = article.galeria.filter(hostedImage);
        elements.galleryUrls.value = article.galeria.filter((src) => !hostedImage(src)).join("\n");
      } else {
        elements.editorTitle.textContent = "Nova notícia";
        elements.id.value = "";
      }
      syncAdFields();
      updateFileLists();
      updatePreview();
    }

    const editId = new URLSearchParams(location.search).get("id");
    if (editId) {
      try {
        const data = await api("/api/noticias");
        const article = (data.articles || []).map(normalizeArticle).find((item) => item.id === editId || item.slug === editId);
        if (!article) notify("Notícia não encontrada. Você pode criar uma nova.", "error");
        fill(article || null);
      } catch (error) {
        notify(error.message, "error");
        fill(null);
      }
    } else {
      fill(null);
    }

    async function uploadFile(file, { video = false } = {}) {
      if (video) {
        const allowed = /^video\/(mp4|webm|quicktime)$/.test(file.type) || (!file.type && /\.(mp4|webm|mov)$/i.test(file.name));
        if (!allowed) throw new Error(`${file.name}: use MP4, WebM ou MOV.`);
        if (file.size > MAX_VIDEO_SIZE) throw new Error(`${file.name}: o limite é 50 MB.`);
      } else {
        if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) throw new Error(`${file.name}: formato não permitido.`);
        if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: o limite é 2 MB.`);
      }
      const form = new FormData();
      form.append("file", file);
      return (await api("/api/upload", { method: "POST", body: form })).url;
    }

    elements.title.addEventListener("input", () => {
      if (!elements.id.value || !elements.slug.dataset.edited) elements.slug.value = slugify(elements.title.value);
      updatePreview();
    });
    elements.slug.addEventListener("input", () => {
      elements.slug.value = slugify(elements.slug.value);
      elements.slug.dataset.edited = "true";
      updatePreview();
    });
    [elements.category, elements.date, elements.status, elements.summary, elements.content, elements.content2, elements.coverUrl, elements.galleryUrls, elements.adUrl, elements.adVideo]
      .forEach((input) => input?.addEventListener("input", updatePreview));
    elements.adType?.addEventListener("change", () => {
      if (elements.adType.value === "video") uploadedAd = "";
      else uploadedVideo = "";
      syncAdFields();
      updateFileLists();
      updatePreview();
    });
    elements.adVideo?.addEventListener("input", () => {
      if (elements.adVideo.value.trim() && uploadedVideo) {
        uploadedVideo = "";
        if (elements.adVideoUpload) elements.adVideoUpload.value = "";
        updateFileLists();
      }
    });

    elements.coverUpload.addEventListener("change", async () => {
      const file = elements.coverUpload.files[0];
      if (!file) return;
      try {
        uploadedCover = await uploadFile(file);
        elements.coverUrl.value = "";
        updateFileLists();
        updatePreview();
      } catch (error) {
        elements.coverUpload.value = "";
        notify(error.message, "error");
      }
    });

    elements.adVideoUpload?.addEventListener("change", async () => {
      const file = elements.adVideoUpload.files[0];
      if (!file) return;
      try {
        uploadedVideo = await uploadFile(file, { video: true });
        if (elements.adVideo) elements.adVideo.value = "";
        updateFileLists();
        updatePreview();
      } catch (error) {
        elements.adVideoUpload.value = "";
        notify(error.message, "error");
      }
    });

    elements.adUpload?.addEventListener("change", async () => {
      const file = elements.adUpload.files[0];
      if (!file) return;
      try {
        uploadedAd = await uploadFile(file);
        if (elements.adUrl) elements.adUrl.value = "";
        updateFileLists();
        updatePreview();
      } catch (error) {
        elements.adUpload.value = "";
        notify(error.message, "error");
      }
    });

    elements.galleryUpload.addEventListener("change", async () => {
      const files = [...elements.galleryUpload.files];
      const urlCount = elements.galleryUrls.value.split(/\r?\n|,/).map(safeImageSource).filter(Boolean).length;
      if (files.length + uploadedGallery.length + urlCount > MAX_GALLERY_FILES) {
        elements.galleryUpload.value = "";
        notify(`A galeria aceita no máximo ${MAX_GALLERY_FILES} imagens no total.`, "error");
        return;
      }
      try {
        uploadedGallery.push(...await Promise.all(files.map(uploadFile)));
        elements.galleryUpload.value = "";
        updateFileLists();
        updatePreview();
      } catch (error) {
        elements.galleryUpload.value = "";
        notify(error.message, "error");
      }
    });

    elements.galleryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-gallery]");
      if (!button) return;
      uploadedGallery.splice(Number(button.dataset.removeGallery), 1);
      updateFileLists();
      updatePreview();
    });
    elements.coverInfo?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-clear-cover]")) return;
      uploadedCover = "";
      if (elements.coverUpload) elements.coverUpload.value = "";
      updateFileLists();
      updatePreview();
    });
    elements.adInfo?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-clear-ad]")) return;
      uploadedAd = "";
      if (elements.adUpload) elements.adUpload.value = "";
      updateFileLists();
      updatePreview();
    });
    elements.adVideoInfo?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-clear-video]")) return;
      uploadedVideo = "";
      if (elements.adVideoUpload) elements.adVideoUpload.value = "";
      updateFileLists();
      updatePreview();
    });

    $("#open-preview")?.addEventListener("click", () => {
      elements.dialogPreview.innerHTML = articlePreviewHTML(currentFormArticle());
      elements.previewDialog.showModal();
    });
    $("[data-close-preview]")?.addEventListener("click", () => elements.previewDialog.close());

    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const required = [elements.title, elements.slug, elements.category, elements.date, elements.summary, elements.content];
      required.forEach((input) => input.removeAttribute("aria-invalid"));
      const invalid = required.find((input) => !input.value.trim() || !input.checkValidity());
      if (invalid) {
        invalid.setAttribute("aria-invalid", "true");
        invalid.focus();
        notify("Revise os campos obrigatórios destacados.", "error");
        return;
      }
      try {
        const article = currentFormArticle();
        const data = await api("/api/noticias", { method: "POST", body: JSON.stringify({ article }) });
        const saved = data.article || article;
        elements.id.value = saved.id;
        elements.editorTitle.textContent = "Editar notícia";
        history.replaceState(null, "", `noticia.html?id=${encodeURIComponent(saved.id)}`);
        updatePreview();
        notify(saved.status === "Publicado"
          ? "Notícia salva. Já está no site público."
          : "Rascunho salvo. Publique para aparecer no site.");
      } catch (error) {
        if (/slug/i.test(error.message)) {
          elements.slug.setAttribute("aria-invalid", "true");
          elements.slug.focus();
        }
        notify(error.message, "error");
      }
    });
  }

  async function initOuvidoria() {
    const notify = notifyFactory();
    let messages = [];
    let selectedId = null;
    const list = $("#inbox-list");
    const detail = $("#inbox-detail");
    const empty = $("#ouvidoria-empty");
    const search = $("#ouvidoria-search");
    const typeFilter = $("#ouvidoria-type");
    const count = $("#ouvidoria-count");

    async function refresh() {
      const data = await api("/api/ouvidoria");
      messages = data.messages || [];
    }

    function filtered() {
      const query = (search?.value || "").trim().toLocaleLowerCase("pt-BR");
      const type = typeFilter?.value || "";
      return messages.filter((item) => {
        if (type && item.tipo !== type) return false;
        if (!query) return true;
        return `${item.assunto} ${item.nome} ${item.email} ${item.mensagem} ${item.protocol}`.toLocaleLowerCase("pt-BR").includes(query);
      });
    }

    function renderDetail(item) {
      if (!detail) return;
      if (!item) {
        detail.innerHTML = `<div class="inbox-placeholder"><span aria-hidden="true">✉</span><h3>Selecione uma manifestação</h3><p>Escolha um item à esquerda para ler o conteúdo completo.</p></div>`;
        return;
      }
      detail.innerHTML = `
        <div class="inbox-detail-head">
          <span class="badge badge-published">${escapeHTML(item.tipo)}</span>
          <code>${escapeHTML(item.protocol)}</code>
        </div>
        <h2>${escapeHTML(item.assunto)}</h2>
        <p class="inbox-from"><strong>${escapeHTML(item.nome)}</strong> · ${escapeHTML(item.email)}${item.bairro ? ` · ${escapeHTML(item.bairro)}` : ""}</p>
        <p class="muted">${formatDate(item.createdAt)}</p>
        <div class="inbox-message">${escapeHTML(item.mensagem)}</div>
        <div class="form-actions">
          <a class="button button-secondary" href="mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Re: " + item.assunto)}">Responder por e-mail</a>
          <button class="button button-danger" type="button" data-delete-message="${escapeHTML(item.id)}">Excluir</button>
        </div>`;
    }

    function render() {
      const items = filtered();
      if (count) count.textContent = `${items.length} manifesto(s)`;
      if (!items.length) {
        list.innerHTML = "";
        empty.hidden = false;
        renderDetail(null);
        return;
      }
      empty.hidden = true;
      if (!items.some((item) => item.id === selectedId)) selectedId = items[0].id;
      list.innerHTML = items.map((item) => `
        <button class="inbox-card ${item.id === selectedId ? "active" : ""}" type="button" data-open-message="${escapeHTML(item.id)}">
          <strong>${escapeHTML(item.assunto)}</strong>
          <small>${escapeHTML(item.nome)} · ${escapeHTML(item.tipo)}${item.protocol ? ` · ${escapeHTML(item.protocol)}` : ""}</small>
          <span>${escapeHTML(item.mensagem)}</span>
        </button>`).join("");
      renderDetail(items.find((item) => item.id === selectedId));
    }

    try {
      await refresh();
      render();
    } catch (error) {
      notify(error.message, "error");
    }

    list?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-message]");
      if (!button) return;
      selectedId = button.dataset.openMessage;
      render();
    });
    search?.addEventListener("input", render);
    typeFilter?.addEventListener("input", render);
    detail?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-message]");
      if (!button) return;
      if (!window.confirm("Excluir esta manifestação do banco de dados?")) return;
      try {
        await api(`/api/ouvidoria?id=${encodeURIComponent(button.dataset.deleteMessage)}`, { method: "DELETE" });
        selectedId = null;
        await refresh();
        render();
        notify("Manifestação excluída.");
      } catch (error) {
        notify(error.message, "error");
      }
    });
  }

  function boot(event) {
    const session = event.detail || window.YuriAdmin?.session || {};
    if (page === "overview") initOverview(session);
    if (page === "noticias") initNews();
    if (page === "noticia") initEditor();
    if (page === "ouvidoria") initOuvidoria();
  }

  if (page === "login") initLogin();
  else window.addEventListener("yfr-admin-ready", boot, { once: true });
})();
