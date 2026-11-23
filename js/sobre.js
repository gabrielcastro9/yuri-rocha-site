(() => {
  "use strict";

  const ICONS = {
    infra: `<svg viewBox="0 0 32 32" fill="none"><path d="M11 4h10l6 24H5L11 4Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M16 10v3.2M16 17.2v3.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    saude: `<svg viewBox="0 0 32 32" fill="none"><path d="M8 3.5v10M3 8.5h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18 15.5 23 13l5 2.5V25l-5 2.5L18 25V15.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M23 13v14.5" stroke="currentColor" stroke-width="2"/></svg>`,
    desenvolvimento: `<svg viewBox="0 0 32 32" fill="none"><path d="M5 26h22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8 21l6-6 4 3.5L26 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 8h6v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));

  const emphasis = (value = "") => escapeHTML(value).replace(/\*([^*]+)\*/g, "<em>$1</em>");

  function journeySection(page, headingId) {
    const facts = (page.facts || []).map((item) =>
      `<li><strong>${escapeHTML(item.value)}</strong><span>${escapeHTML(item.label)}</span></li>`
    ).join("");
    const steps = (page.steps || []).map((item, index) => `
      <li class="journey-step">
        <span class="journey-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
        <small>${escapeHTML(item.kicker)}</small>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.text)}</p>
      </li>`).join("");
    const photo = page.photo
      ? `<figure class="journey-photo"><img src="${escapeHTML(page.photo)}" alt="${escapeHTML(page.photoAlt)}"><figcaption>${escapeHTML(page.photoCaption)}</figcaption></figure>`
      : "";
    return `
      <section class="journey" data-journey-mirror aria-labelledby="${escapeHTML(headingId)}">
        <div class="journey-glow" aria-hidden="true"></div>
        <div class="container journey-layout">
          ${photo}
          <div class="journey-copy">
            <span class="eyebrow eyebrow--light">${escapeHTML(page.journeyEyebrow)}</span>
            <h2 id="${escapeHTML(headingId)}">${emphasis(page.journeyTitle)}</h2>
            <p class="lead">${escapeHTML(page.journeyLead)}</p>
            ${facts ? `<ul class="journey-facts">${facts}</ul>` : ""}
          </div>
        </div>
        ${steps ? `<div class="container"><ol class="journey-path">${steps}</ol></div>` : ""}
      </section>`;
  }

  function render(page) {
    const main = document.querySelector("main#conteudo[data-sobre-page]");
    if (!main || !page) return;
    const fronts = (page.fronts || []).map((item) => `
      <article class="card reveal">
        <div class="card-icon" aria-hidden="true">${ICONS[item.icon] || ICONS.infra}</div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.text)}</p>
      </article>`).join("");
    main.innerHTML = `
      <section class="page-hero"><div class="container"><span class="eyebrow eyebrow--light">${escapeHTML(page.heroEyebrow)}</span><h1>${escapeHTML(page.heroTitle)}</h1><p class="lead">${escapeHTML(page.heroLead)}</p></div></section>
      ${journeySection(page, "jornada-titulo")}
      <section class="section"><div class="container">
        <div class="section-head"><div><span class="eyebrow">${escapeHTML(page.mandateEyebrow)}</span><h2>${escapeHTML(page.mandateTitle)}</h2></div><p class="lead">${escapeHTML(page.mandateLead)}</p></div>
        ${fronts ? `<div class="grid-3">${fronts}</div>` : ""}
      </div></section>`;
  }

  fetch("/api/sobre")
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      const page = data?.page;
      if (!page) return;
      render(page);
      const mirror = document.querySelector("[data-journey-mirror]");
      if (mirror && !mirror.closest("[data-sobre-page]")) {
        const headingId = mirror.getAttribute("aria-labelledby") || "jornada-inicio";
        mirror.outerHTML = journeySection(page, headingId);
      }
    })
    .catch(() => {});
})();
