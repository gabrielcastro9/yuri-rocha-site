import { initCarousel } from "./carousel.js";

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function startAtTop() {
  if (location.hash) return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

startAtTop();
addEventListener("pageshow", (event) => {
  if (!event.persisted) startAtTop();
});
addEventListener("load", startAtTop);

export const demoNews = [
  {id:"dialogo-infraestrutura",title:"Diálogo sobre infraestrutura e mobilidade urbana",category:"Infraestrutura",date:"2026-07-18",excerpt:"Conteúdo editorial demonstrativo sobre escuta, planejamento e prioridades para os espaços públicos de Itapajé.",image:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",content:["Este é um conteúdo editorial demonstrativo criado para apresentar o funcionamento do portal. Não representa anúncio de obra, compromisso oficial ou resultado já alcançado.","A atuação legislativa pode contribuir com fiscalização, escuta comunitária e articulação institucional para que demandas de infraestrutura sejam registradas e discutidas com transparência."],content2:["Informações oficiais poderão substituir este texto por meio da área de administração do portal. O padrão da página permanece o mesmo: título, imagem, texto, propaganda, carrossel e texto final."],ad:"https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1400&q=80",gallery:["https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80","https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1400&q=80"],isDemo:true},
  {id:"educacao-futuro",title:"Educação e oportunidades no centro da conversa",category:"Educação",date:"2026-06-26",excerpt:"Conteúdo demonstrativo sobre caminhos para ampliar oportunidades e fortalecer a formação dos jovens.",image:"https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80",content:["Notícia demonstrativa para composição visual do site. O texto não informa política pública aprovada nem atribui resultados ao mandato.","Educação, qualificação e conexão com oportunidades são temas permanentes para o desenvolvimento local. A participação da comunidade ajuda a tornar o debate público mais representativo."],isDemo:true},
  {id:"escuta-comunidade",title:"Escuta ativa para aproximar comunidade e mandato",category:"Mandato",date:"2026-05-09",excerpt:"Conteúdo demonstrativo sobre participação cidadã, transparência e construção coletiva.",image:"https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=80",content:["Este material é demonstrativo e poderá ser atualizado com agendas, documentos e informações verificadas do mandato.","A ouvidoria digital deste portal foi concebida como um canal simples para receber sugestões, solicitações e manifestações da população."],isDemo:true}
];

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[character]));

function safeImageSource(value = "") {
  const source = String(value).trim();
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source;
  if (source.startsWith("/uploads/")) return source.split("#")[0];
  if (source.startsWith("/") && /\.(png|jpe?g|gif|webp|avif)$/i.test(source.split("?")[0])) return source;
  try {
    const url = new URL(source, location.href);
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

function youtubeId(value = "") {
  const source = String(value).trim();
  const match = source.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|[?&]v=)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : "";
}

function normalizePublicArticle(item = {}) {
  const title = String(item.titulo || item.title || "Publicação sem título");
  const rawContent = item.conteudo ?? item.content ?? item.resumo ?? item.excerpt ?? "";
  const rawContent2 = item.conteudo2 ?? item.content2 ?? "";
  return {
    id: String(item.slug || item.id || ""),
    rawId: String(item.id || item.slug || ""),
    slug: String(item.slug || item.id || ""),
    title,
    category: String(item.categoria || item.category || "Mandato"),
    date: String(item.data || item.date || "").slice(0, 10),
    excerpt: String(item.resumo || item.excerpt || ""),
    image: safeImageSource(item.imagem || item.image || ""),
    content: Array.isArray(rawContent) ? rawContent.map(String) : String(rawContent),
    content2: Array.isArray(rawContent2) ? rawContent2.map(String) : String(rawContent2),
    adType: item.propagandaTipo === "video" || item.adType === "video" ? "video" : "imagem",
    ad: String(item.propaganda || item.ad || "").trim(),
    gallery: Array.isArray(item.galeria || item.gallery) ? (item.galeria || item.gallery).map(safeImageSource).filter(Boolean) : [],
    isDemo: Boolean(item.isDemo)
  };
}

export async function getNews() {
  try {
    const response = await fetch("/api/noticias", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      const published = Array.isArray(payload.articles)
        ? payload.articles.map(normalizePublicArticle)
        : [];
      if (published.length) return published;
    }
  } catch (error) {
    console.warn("Não foi possível carregar as notícias do servidor.", error);
  }
  return demoNews.map(normalizePublicArticle);
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", {dateStyle:"long"}).format(date);
}

function card(item) {
  const image = safeImageSource(item.image);
  const href = `noticia.html?id=${encodeURIComponent(item.id)}`;
  return `<article class="news-card reveal" data-category="${escapeHTML(item.category)}" data-search="${escapeHTML(`${item.title} ${item.excerpt}`)}">
    <a class="news-media" href="${href}" aria-label="Ler: ${escapeHTML(item.title)}">
      ${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : '<span class="news-media-placeholder" aria-hidden="true">YR</span>'}
      <span class="news-image-shine" aria-hidden="true"></span>
    </a>
    <div class="news-body">
      <div class="news-meta"><span class="tag">${escapeHTML(item.category)}</span><time datetime="${escapeHTML(item.date)}">${escapeHTML(formatDate(item.date))}</time></div>
      <h3><a href="${href}">${escapeHTML(item.title)}</a></h3>
      <p>${escapeHTML(item.excerpt)}</p>
      <a class="news-read" href="${href}"><span>Ler publicação</span><i aria-hidden="true">↗</i></a>
    </div>
  </article>`;
}

const header = document.querySelector(".site-header");
const menu = document.querySelector("[data-menu-toggle]");
function setMenu(open) {
  header?.classList.toggle("menu-open", open);
  menu?.setAttribute("aria-expanded", String(open));
  if (menu) menu.textContent = open ? "✕" : "☰";
}
menu?.addEventListener("click", () => setMenu(!header.classList.contains("menu-open")));
document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", () => setMenu(false)));
addEventListener("scroll", () => header?.classList.toggle("scrolled", scrollY > 24), {passive:true});

const scrollProgress = document.createElement("div");
scrollProgress.className = "scroll-progress";
scrollProgress.setAttribute("aria-hidden", "true");
document.body.append(scrollProgress);
let progressFrame;
function updateScrollProgress() {
  const available = document.documentElement.scrollHeight - innerHeight;
  const progress = available > 0 ? Math.min(Math.max(scrollY / available, 0), 1) : 0;
  scrollProgress.style.transform = `scaleX(${progress})`;
  progressFrame = null;
}
addEventListener("scroll", () => {
  if (!progressFrame) progressFrame = requestAnimationFrame(updateScrollProgress);
}, {passive:true});
updateScrollProgress();

const showcase = document.querySelector(".hero-showcase");
const canTilt = matchMedia("(hover: hover) and (pointer: fine)").matches
  && !matchMedia("(prefers-reduced-motion: reduce)").matches;

if (showcase && canTilt) {
  let animationFrame;

  showcase.addEventListener("pointerenter", () => showcase.classList.add("is-tilting"));
  showcase.addEventListener("pointermove", event => {
    if (animationFrame) return;
    animationFrame = requestAnimationFrame(() => {
      const bounds = showcase.getBoundingClientRect();
      const x = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
      const y = Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
      showcase.style.setProperty("--tilt-x", `${(0.5 - y) * 8}deg`);
      showcase.style.setProperty("--tilt-y", `${(x - 0.5) * 10}deg`);
      showcase.style.setProperty("--spot-x", `${x * 100}%`);
      showcase.style.setProperty("--spot-y", `${y * 100}%`);
      showcase.style.setProperty("--image-x", `${(0.5 - x) * 10}px`);
      showcase.style.setProperty("--image-y", `${(0.5 - y) * 8}px`);
      animationFrame = null;
    });
  });
  showcase.addEventListener("pointerleave", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    showcase.classList.remove("is-tilting");
    showcase.style.setProperty("--tilt-x", "0deg");
    showcase.style.setProperty("--tilt-y", "-3deg");
    showcase.style.setProperty("--spot-x", "50%");
    showcase.style.setProperty("--spot-y", "50%");
    showcase.style.setProperty("--image-x", "0px");
    showcase.style.setProperty("--image-y", "0px");
  });
}

const newsContainer = document.querySelector("[data-news]");
if (newsContainer) {
  const limit = Number(newsContainer.dataset.limit || 99);
  const news = await getNews();
  newsContainer.innerHTML = news.slice(0, limit).map(card).join("");
  newsContainer.querySelectorAll(".news-card").forEach((cardElement, index) => {
    cardElement.style.setProperty("--reveal-delay", `${index * 90}ms`);
    cardElement.classList.add("visible");
  });
  initNewsCarousel(newsContainer.closest("[data-news-carousel]"));
}

function initNewsCarousel(carousel) {
  if (!carousel) return;

  const track = carousel.querySelector("[data-news]");
  const slides = [...carousel.querySelectorAll(".news-card")];
  const dots = carousel.querySelector("[data-news-dots]");
  const status = carousel.querySelector("[data-news-status]");
  const progress = carousel.querySelector("[data-news-progress]");
  const prev = carousel.querySelector("[data-news-prev]");
  const next = carousel.querySelector("[data-news-next]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const interval = 7000;
  let index = 0;
  let timer;

  if (slides.length < 2) {
    carousel.querySelector(".news-carousel-controls")?.setAttribute("hidden", "");
    carousel.querySelector(".news-carousel-bar")?.setAttribute("hidden", "");
    return;
  }

  dots.innerHTML = slides.map((_, i) =>
    `<button class="news-dot" type="button" aria-label="Ir para a notícia ${i + 1}"></button>`
  ).join("");
  const dotButtons = [...dots.querySelectorAll(".news-dot")];

  function goTo(nextIndex, announce = true) {
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== index)));
    dotButtons.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
      dot.setAttribute("aria-current", i === index ? "true" : "false");
    });
    if (announce && status) status.textContent = `Notícia ${index + 1} de ${slides.length}`;
    restartProgress();
  }

  function restartProgress() {
    if (!progress) return;
    progress.style.animation = "none";
    progress.offsetHeight;
    if (!reducedMotion && !document.hidden) {
      progress.style.animation = `newsProgress ${interval}ms linear`;
    }
  }

  function start() {
    clearInterval(timer);
    if (reducedMotion || document.hidden) return;
    timer = setInterval(() => goTo(index + 1, false), interval);
    restartProgress();
  }

  function restart() {
    clearInterval(timer);
    start();
  }

  prev?.addEventListener("click", () => { goTo(index - 1); restart(); });
  next?.addEventListener("click", () => { goTo(index + 1); restart(); });
  dotButtons.forEach((dot, i) => dot.addEventListener("click", () => { goTo(i); restart(); }));
  carousel.addEventListener("mouseenter", () => {
    clearInterval(timer);
    if (progress) progress.style.animationPlayState = "paused";
  });
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", () => {
    clearInterval(timer);
    if (progress) progress.style.animationPlayState = "paused";
  });
  carousel.addEventListener("focusout", event => {
    if (!carousel.contains(event.relatedTarget)) start();
  });
  document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(timer) : start());
  addEventListener("resize", () => goTo(index, false));

  goTo(0, false);
  start();
}

const newsPage = document.querySelector("[data-news-page]");
if (newsPage) {
  const input = document.querySelector("[data-news-search]");
  const buttons = [...document.querySelectorAll("[data-filter]")];
  let category = "Todos";
  const filter = () => {
    const term = input.value.trim().toLocaleLowerCase("pt-BR");
    let visible = 0;
    newsPage.querySelectorAll(".news-card").forEach(item => {
      const matches = (category === "Todos" || item.dataset.category === category) && item.dataset.search.toLocaleLowerCase("pt-BR").includes(term);
      item.hidden = !matches;
      if (matches) visible++;
    });
    document.querySelector("[data-results]").textContent = visible ? `${visible} publicação(ões) encontrada(s).` : "Nenhuma publicação encontrada.";
  };
  input?.addEventListener("input", filter);
  buttons.forEach(button => button.addEventListener("click", () => {
    category = button.dataset.filter;
    buttons.forEach(btn => { btn.classList.toggle("active", btn === button); btn.setAttribute("aria-pressed", String(btn === button)); });
    filter();
  }));
}

function inlineMarkdown(value) {
  return escapeHTML(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderContent(content) {
  const source = Array.isArray(content) ? content.join("\n\n") : String(content || "");
  const blocks = source.replace(/\r\n?/g, "\n").split(/\n{2,}/).filter(Boolean);
  return blocks.map(block => {
    const lines = block.split("\n");
    if (lines.every(line => /^-\s+/.test(line))) {
      return `<ul>${lines.map(line => `<li>${inlineMarkdown(line.replace(/^-\s+/, ""))}</li>`).join("")}</ul>`;
    }
    const heading = block.match(/^(#{1,3})\s+(.+)$/s);
    if (heading && !heading[2].includes("\n")) {
      const level = Math.min(heading[1].length + 1, 4);
      return `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
    }
    return `<p>${lines.map(inlineMarkdown).join("<br>")}</p>`;
  }).join("");
}

function readingMinutes(item) {
  const text = [item.content, item.content2].flat().join(" ");
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180) || 1);
}

function renderStoryAd(item) {
  if (item.adType === "video") {
    const id = youtubeId(item.ad);
    const file = /\.(mp4|webm|mov)(\?|#|$)/i.test(item.ad || "");
    if (!id && !file) return "";
    return `<aside class="story-ad" aria-label="Conteúdo de apoio">
      <div class="story-video">
        ${id
          ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHTML(id)}" title="Propaganda em vídeo" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
          : `<video src="${escapeHTML(item.ad)}" controls playsinline preload="metadata"></video>`}
      </div>
    </aside>`;
  }
  const image = safeImageSource(item.ad);
  if (!image) return "";
  return `<aside class="story-ad" aria-label="Conteúdo de apoio">
    <figure class="story-ad-frame">
      <img src="${escapeHTML(image)}" alt="Propaganda da publicação" loading="lazy">
    </figure>
  </aside>`;
}

function renderStoryGallery(item) {
  if (!item.gallery.length) return "";
  if (item.gallery.length === 1) {
    return `<section class="story-gallery" aria-label="Galeria">
      <figure class="story-single">
        <img src="${escapeHTML(item.gallery[0])}" alt="Galeria de ${escapeHTML(item.title)}" loading="lazy">
      </figure>
    </section>`;
  }
  return `<section class="story-gallery story-carousel" data-carousel data-autoplay="off" aria-label="Carrossel de imagens">
    <div class="carousel-viewport story-carousel-viewport">
      <div class="carousel-track">
        ${item.gallery.map((src, index) => `
          <figure class="slide story-slide">
            <img src="${escapeHTML(src)}" alt="Galeria de ${escapeHTML(item.title)}, imagem ${index + 1}" loading="lazy" draggable="false">
          </figure>`).join("")}
      </div>
      <p class="story-carousel-count" data-carousel-count>1 / ${item.gallery.length}</p>
      <button class="story-carousel-nav story-carousel-nav--prev" data-prev type="button" aria-label="Imagem anterior">‹</button>
      <button class="story-carousel-nav story-carousel-nav--next" data-next type="button" aria-label="Próxima imagem">›</button>
    </div>
    <div class="carousel-bar" aria-hidden="true"><span data-carousel-progress></span></div>
    <p class="visually-hidden" data-carousel-status aria-live="polite"></p>
    <div class="carousel-controls">
      <button class="icon-button story-carousel-desk-nav" data-prev aria-label="Imagem anterior" type="button">←</button>
      <div class="carousel-dots" data-carousel-dots></div>
      <button class="icon-button story-carousel-desk-nav" data-next aria-label="Próxima imagem" type="button">→</button>
    </div>
  </section>`;
}

const article = document.querySelector("[data-article]");
if (article) {
  const id = new URLSearchParams(location.search).get("id");
  const news = await getNews();
  const item = news.find((entry) => entry.id === id || entry.slug === id || entry.rawId === id);
  if (!item) {
    document.title = "Publicação não encontrada | Yuri Farias Rocha";
    article.innerHTML = `<div class="story-shell">
      <header class="story-hero">
        <h1>Publicação não encontrada</h1>
        <p class="lead">O conteúdo solicitado não existe ou não está mais publicado.</p>
        <a class="button button--outline" href="noticias.html">← Voltar às notícias</a>
      </header>
    </div>`;
  } else {
    const image = safeImageSource(item.image);
    const minutes = readingMinutes(item);
    const related = news.filter((entry) => entry.id !== item.id).slice(0, 3);
    document.title = `${item.title} | Yuri Farias Rocha`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", item.excerpt || item.title);
    article.innerHTML = `
      <div class="story-atmosphere" aria-hidden="true"></div>
      <div class="story-shell">
        <header class="story-hero">
          <nav class="story-crumb" aria-label="Navegação da notícia">
            <a href="noticias.html">Notícias</a>
            <span aria-hidden="true">/</span>
            <span>${escapeHTML(item.category)}</span>
          </nav>
          <h1>${escapeHTML(item.title)}</h1>
          <div class="story-meta">
            <time datetime="${escapeHTML(item.date)}">${escapeHTML(formatDate(item.date))}</time>
            <span>${minutes} min de leitura</span>
            ${item.isDemo ? "<span>Conteúdo demonstrativo</span>" : ""}
          </div>
        </header>

        ${image ? `<figure class="story-cover">
          <img src="${escapeHTML(image)}" alt="Imagem de capa de ${escapeHTML(item.title)}">
        </figure>` : ""}

        <section class="story-prose" aria-label="Texto inicial">
          ${renderContent(item.content)}
        </section>

        ${renderStoryAd(item)}
        ${renderStoryGallery(item)}

        ${item.content2 ? `<section class="story-prose" aria-label="Texto final">
          ${renderContent(item.content2)}
        </section>` : ""}

        <footer class="story-end">
          <div class="story-end-actions">
            <a class="button button--outline" href="noticias.html">← Todas as notícias</a>
            <button class="button button--gold" type="button" data-copy-link>Copiar link</button>
            <a class="button button--outline" href="https://www.instagram.com/yurifrocha?utm_source=ig_web_button_share_sheet&srtk=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener">yurifrocha</a>
          </div>
        </footer>
      </div>
      ${related.length ? `<aside class="story-more" aria-label="Outras publicações">
        <div class="container">
          <p class="eyebrow">Continue lendo</p>
          <h2>Outras publicações</h2>
          <div class="news-grid">${related.map(card).join("")}</div>
        </div>
      </aside>` : ""}`;
    article.querySelectorAll("[data-carousel]").forEach(initCarousel);
    article.querySelectorAll(".story-cover img, .story-ad-frame img, .story-single img, .story-slide img").forEach((img) => {
      img.addEventListener("error", () => {
        const slide = img.closest(".story-slide, .story-single, .story-ad-frame, .story-cover");
        const gallery = img.closest(".story-gallery");
        const ad = img.closest(".story-ad");
        slide?.remove();
        if (gallery && !gallery.querySelector("img")) gallery.remove();
        if (ad && !ad.querySelector("img, iframe")) ad.remove();
      });
    });
    article.querySelector("[data-copy-link]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        await navigator.clipboard.writeText(location.href);
        button.textContent = "Link copiado";
      } catch {
        button.textContent = "Não foi possível copiar";
      }
      window.setTimeout(() => { button.textContent = "Copiar link"; }, 2200);
    });
  }
  startAtTop();
}

const form = document.querySelector("[data-contact-form]");
form?.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const status = document.querySelector("[data-form-status]");
  const submit = form.querySelector("[type='submit']");
  submit.disabled = true;
  try {
    const response = await fetch("/api/ouvidoria", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a mensagem.");
    form.reset();
    status.textContent = `Mensagem recebida. Protocolo: ${payload.protocol}.`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

const revealObserver = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add("visible"); revealObserver.unobserve(entry.target); }
}),{threshold:.12}) : null;
document.querySelectorAll(".reveal").forEach(el => revealObserver ? revealObserver.observe(el) : el.classList.add("visible"));
document.querySelector("[data-back-top]")?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});
document.querySelector("[data-year]")?.replaceChildren(String(new Date().getFullYear()));
