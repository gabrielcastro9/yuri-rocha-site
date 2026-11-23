(() => {
  "use strict";

  const page = document.body?.dataset.adminPage;
  if (!page || page === "login") return;

  const NAV = [
    { id: "overview", href: "dashboard.html", icon: "⌂", label: "Visão geral", hint: "Resumo do mandato" },
    { id: "noticias", href: "noticias.html", icon: "▤", label: "Notícias", hint: "Publicações do portal" },
    { id: "mapa", href: "mapa.html", icon: "◉", label: "Mapa", hint: "Pontos de Itapajé" },
    { id: "sobre", href: "sobre.html", icon: "✎", label: "Página Sobre", hint: "Gerenciar página Sobre" },
    { id: "ouvidoria", href: "ouvidoria.html", icon: "✉", label: "Ouvidoria", hint: "Mensagens da cidade" },
    { id: "noticia", href: "noticia.html", icon: "＋", label: "Nova notícia", hint: "Editor de conteúdo" }
  ];

  const TITLES = {
    overview: { eyebrow: "Painel", title: "Visão geral" },
    noticias: { eyebrow: "Conteúdo", title: "Notícias" },
    mapa: { eyebrow: "Território", title: "Mapa de Itapajé" },
    sobre: { eyebrow: "Página pública", title: "Gerenciar Página Sobre" },
    ouvidoria: { eyebrow: "Canal aberto", title: "Ouvidoria" },
    noticia: { eyebrow: "Editor", title: "Nova notícia" }
  };

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        credentials: "include",
        ...options,
        headers: options.body instanceof FormData
          ? options.headers
          : { "Content-Type": "application/json", ...options.headers }
      });
    } catch {
      throw new Error("Não foi possível falar com o servidor.");
    }
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {
      throw new Error("A API não está no ar. Rode npm run dev.");
    }
    if (!response.ok) {
      const error = new Error(data.error || "Não foi possível concluir a operação.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function fillChrome(session) {
    const sidebar = document.querySelector("[data-shell='sidebar']");
    const topbar = document.querySelector("[data-shell='topbar']");
    const meta = TITLES[page] || TITLES.overview;
    const initial = String(session.user || "AD").slice(0, 2).toUpperCase();

    if (sidebar) {
      sidebar.innerHTML = `
        <a class="brand brand-sidebar" href="../index.html" aria-label="Yuri Rocha — página inicial">
          <span class="brand-mark" aria-hidden="true">YR</span>
          <span><strong>Yuri Rocha</strong><small>Painel do mandato</small></span>
        </a>
        <nav aria-label="Seções do painel">
          ${NAV.map((item) => `
            <a class="nav-link ${item.id === "noticia" ? "nav-link-compose" : ""} ${item.id === page ? "active" : ""}" href="${item.href}" ${item.id === page ? 'aria-current="page"' : ""}>
              <span class="nav-ico" aria-hidden="true">${item.icon}</span>
              <span class="nav-copy"><strong>${item.label}</strong><small>${item.hint}</small></span>
            </a>
          `).join("")}
        </nav>
        <div class="sidebar-footer">
          <button id="logout-button" class="button button-ghost button-block" type="button">Sair do painel</button>
        </div>`;
    }

    if (topbar) {
      topbar.innerHTML = `
        <button id="menu-button" class="button button-icon menu-button" type="button" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false">☰</button>
        <div>
          <p class="eyebrow">${escapeHTML(meta.eyebrow)}</p>
          <strong id="topbar-title">${escapeHTML(meta.title)}</strong>
        </div>
        <div class="topbar-actions">
          <a class="button button-secondary desktop-only" href="../index.html" target="_blank" rel="noopener">Ver site <span aria-hidden="true">↗</span></a>
          <span class="avatar" aria-hidden="true">${escapeHTML(initial)}</span>
          <span class="desktop-only"><strong id="session-label">${escapeHTML(session.user)}</strong><small>Sessão segura</small></span>
        </div>`;
    }
  }

  function bindChrome() {
    const sidebar = document.querySelector("#sidebar");
    const menuButton = document.querySelector("#menu-button");
    const overlay = document.querySelector(".sidebar-overlay");

    function setMenu(open) {
      sidebar?.classList.toggle("open", open);
      if (overlay) overlay.hidden = !open;
      menuButton?.setAttribute("aria-expanded", String(open));
      menuButton?.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    }

    menuButton?.addEventListener("click", () => setMenu(!sidebar?.classList.contains("open")));
    overlay?.addEventListener("click", () => setMenu(false));
    document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar?.classList.contains("open")) {
        setMenu(false);
        menuButton?.focus();
      }
    });
    document.querySelector("#logout-button")?.addEventListener("click", async () => {
      try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {}
      window.location.replace("login.html");
    });
  }

  window.YuriAdmin = { api, escapeHTML, page };

  (async () => {
    let session;
    try {
      session = await api("/api/session");
    } catch {
      window.location.replace("login.html");
      return;
    }
    fillChrome(session);
    if (!document.querySelector(".sidebar-overlay")) {
      const overlay = document.createElement("button");
      overlay.className = "sidebar-overlay";
      overlay.type = "button";
      overlay.setAttribute("aria-label", "Fechar menu");
      overlay.hidden = true;
      document.querySelector("#sidebar")?.after(overlay);
    }
    bindChrome();
    window.YuriAdmin.session = session;
    const idleLimit = 15 * 60 * 1000;
    let idleTimer = 0;
    const armIdle = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(async () => {
        try { await api("/api/logout", { method: "POST", body: "{}" }); } catch {}
        window.location.replace("login.html");
      }, idleLimit);
    };
    ["pointerdown", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, armIdle, { passive: true });
    });
    armIdle();
    window.YuriAdmin.ready = true;
    window.dispatchEvent(new CustomEvent("yfr-admin-ready", { detail: session }));
  })();
})();
