(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function boot() {
    const root = document.querySelector("[data-itapaje-map]");
    if (!root) return;
    if (!window.YuriMapa) {
      window.addEventListener("load", boot, { once: true });
      return;
    }

    const {
      REGIONS, VIEW_BOX, OUTLINE_PATH, TITLE_X, TITLE_Y, project,
      loadMapState, formatCurrency, youtubeId
    } = window.YuriMapa;

    const els = {
      totals: root.querySelector("[data-map-totals]"),
      hover: root.querySelector("[data-map-hover]"),
      svg: root.querySelector("[data-map-svg]"),
      outline: root.querySelector("[data-map-outline]"),
      title: root.querySelector("[data-map-title]"),
      markers: root.querySelector("[data-map-markers]"),
      panel: root.querySelector("[data-map-panel]"),
      legendCurrent: root.querySelector("[data-legend-current]")
    };

    if (!els.svg || !els.markers || !els.panel || !els.totals) return;

    els.svg.setAttribute("viewBox", VIEW_BOX);
    if (els.outline) els.outline.setAttribute("d", OUTLINE_PATH);
    if (els.title) {
      els.title.setAttribute("x", TITLE_X);
      els.title.setAttribute("y", TITLE_Y);
    }

    let state = loadMapState();
    window.YuriMapa.ready?.then((loaded) => {
      state = loaded || loadMapState();
      render();
    }).catch(() => render());
    let selectedId = null;
    let hoveredId = null;
    let region = "Todas";
    let type = "Todos";
    let query = "";
    let expandedMedia = null;

    const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));

    function svgEl(name, attrs = {}, text) {
      const node = document.createElementNS(SVG_NS, name);
      Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") node.setAttribute(key, String(value));
      });
      if (text != null) node.textContent = text;
      return node;
    }

    function locations() {
      return (state.locations || []).filter((item) => item.visible !== false);
    }

    function deliveriesFor(locationId) {
      return (state.deliveries || []).filter((item) => item.locationId === locationId);
    }

    function countFor(locationId) {
      return deliveriesFor(locationId).length;
    }

    function investmentFor(locationId) {
      return deliveriesFor(locationId).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    }

    function filteredLocations() {
      const term = query.trim().toLocaleLowerCase("pt-BR");
      return locations()
        .map((location) => ({ location, count: countFor(location.id), investment: investmentFor(location.id) }))
        .filter(({ location }) => {
          if (region !== "Todas" && location.region !== region) return false;
          if (!term) return true;
          return `${location.name} ${location.region}`.toLocaleLowerCase("pt-BR").includes(term);
        })
        .sort((a, b) => a.location.name.localeCompare(b.location.name, "pt-BR"));
    }

    function moneyMarkup(value) {
      const formatted = formatCurrency(value);
      const amount = formatted.replace(/^R\$\s?/, "");
      if (amount === formatted) return `<strong>${escapeHTML(formatted)}</strong>`;
      return `<strong><b>R$</b> ${escapeHTML(amount)}</strong>`;
    }

    function hoverName() {
      return (locations().find((item) => item.id === (hoveredId || selectedId)) || {}).name || "Explore o território";
    }

    function renderTotals() {
      const visible = locations();
      const items = visible.reduce((sum, item) => sum + countFor(item.id), 0);
      const investment = visible.reduce((sum, item) => sum + investmentFor(item.id), 0);
      els.totals.innerHTML = `
        <article class="imap-stat"><small>Comunidades</small><strong>${visible.length}</strong></article>
        <article class="imap-stat"><small>Entregas</small><strong>${items}</strong></article>
        <article class="imap-stat imap-stat--gold"><small>Valor mapeado</small><strong>${formatCurrency(investment)}</strong></article>`;
    }

    function renderMarkers() {
      while (els.markers.firstChild) els.markers.removeChild(els.markers.firstChild);
      const touch = matchMedia("(max-width: 900px)").matches;
      const ordered = [...locations()].sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
      const placedLabels = [];
      const pins = ordered.map((item) => ({ ...project(item.lon, item.lat), id: item.id }));
      const labelLayer = svgEl("g", { class: "map-labels" });
      const boxesOverlap = (a, b, pad = 3) => !(
        a.x > b.x + b.w + pad ||
        b.x > a.x + a.w + pad ||
        a.y > b.y + b.h + pad ||
        b.y > a.y + a.h + pad
      );
      const pinGap = (box, pin) => {
        const nearestX = Math.max(box.x, Math.min(pin.x, box.x + box.w));
        const nearestY = Math.max(box.y, Math.min(pin.y, box.y + box.h));
        return Math.hypot(nearestX - pin.x, nearestY - pin.y);
      };
      ordered.forEach((location) => {
        const count = countFor(location.id);
        const active = selectedId === location.id || hoveredId === location.id;
        const { x, y } = project(location.lon, location.lat);
        const r = count ? (active ? 11 : 9) : 5.5;
        const hitR = touch ? 22 : 16;
        const group = svgEl("g", {
          class: `map-marker${count ? " has-work" : ""}${active ? " is-active" : ""}${selectedId === location.id ? " is-selected" : ""}`,
          "data-marker": location.id
        });

        const hit = svgEl("circle", {
          class: "map-hit",
          cx: x,
          cy: y,
          r: hitR,
          fill: "none",
          stroke: "none",
          "pointer-events": "all",
          role: "button",
          tabindex: count ? "0" : "-1",
          "aria-label": count
            ? `${location.name}, ${count} resultado${count === 1 ? "" : "s"}`
            : `${location.name}, sem resultados`
        });

        if (selectedId === location.id) {
          group.appendChild(svgEl("circle", {
            class: "map-ring",
            cx: x,
            cy: y,
            r: r + 6,
            fill: "none",
            stroke: "#c79a42",
            "stroke-width": "2",
            "pointer-events": "none"
          }));
        }

        group.appendChild(hit);
        group.appendChild(svgEl("circle", {
          class: "map-pin",
          cx: x,
          cy: y,
          r,
          fill: selectedId === location.id || (active && count) ? "#e5c77e" : count ? "#ffffff" : "rgba(255,255,255,0.45)",
          stroke: selectedId === location.id ? "#ffffff" : count ? "#061b3a" : "rgba(255,255,255,0.7)",
          "stroke-width": "2",
          "pointer-events": "none"
        }));

        if (count) {
          group.appendChild(svgEl("text", {
            class: "map-count",
            x,
            y: y + 0.6,
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            "pointer-events": "none",
            fill: "#061b3a",
            "font-size": "12",
            "font-weight": "800"
          }, String(count)));
        }

        const labelSize = active ? 13 : 12;
        const probe = svgEl("text", {
          "font-size": String(labelSize),
          "font-weight": "800",
          "font-family": "Outfit, Inter, sans-serif"
        }, location.name);
        els.svg.appendChild(probe);
        const textWidth = probe.getBBox().width || location.name.length * labelSize * 0.62;
        probe.remove();
        const labelWidth = Math.ceil(textWidth + 16);
        const labelHeight = 20;
        const gap = r + 5;
        const half = labelWidth / 2;
        const directions = [[0, -1], [0, 1], [1, 0], [-1, 0], [0.75, -0.7], [-0.75, -0.7], [0.75, 0.7], [-0.75, 0.7]];
        const candidates = [];
        directions.forEach(([dx, dy]) => {
          const len = Math.hypot(dx, dy);
          const ux = dx / len;
          const uy = dy / len;
          const reach = Math.abs(ux) * half + Math.abs(uy) * (labelHeight / 2);
          [0, 14, 30, 48].forEach((step) => {
            const dist = gap + reach + step;
            candidates.push({
              x: Math.min(428 - labelWidth, Math.max(8, x + ux * dist - half)),
              y: Math.min(378, Math.max(8, y + uy * dist - labelHeight / 2)),
              w: labelWidth,
              h: labelHeight
            });
          });
        });
        const otherPins = pins.filter((pin) => pin.id !== location.id);
        const overlapAmount = (box) => placedLabels.reduce((sum, other) => {
          const width = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
          const height = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
          return sum + (width > 0 && height > 0 ? width * height : 0);
        }, 0) + otherPins.reduce((sum, pin) => sum + (pinGap(box, pin) < 10 ? 400 : 0), 0);
        const ranked = candidates
          .filter((box) => pinGap(box, { x, y }) > r + 2)
          .map((box) => ({ box, near: pinGap(box, { x, y }), overlap: overlapAmount(box) }))
          .sort((a, b) => (a.overlap - b.overlap) || (a.near - b.near));
        const box = (ranked.find((item) => item.overlap === 0) || ranked[0]).box;
        placedLabels.push(box);
        const labelX = box.x + half;
        const labelY = box.y + labelHeight / 2;
        const edgeX = Math.max(box.x, Math.min(x, box.x + box.w));
        const edgeY = Math.max(box.y, Math.min(y, box.y + box.h));
        if (Math.hypot(edgeX - x, edgeY - y) > r + 8) {
          labelLayer.appendChild(svgEl("line", {
            x1: x,
            y1: y,
            x2: edgeX,
            y2: edgeY,
            stroke: active ? "#e5c77e" : "rgba(255,255,255,.75)",
            "stroke-width": "1.25",
            "pointer-events": "none"
          }));
        }
        labelLayer.appendChild(svgEl("rect", {
          class: "map-label-bg",
          x: box.x,
          y: box.y,
          width: labelWidth,
          height: labelHeight,
          rx: 10,
          fill: active ? "#061b3a" : "rgba(6,27,58,.9)",
          stroke: active ? "#e5c77e" : "rgba(255,255,255,.28)",
          "stroke-width": active ? "1.6" : "1",
          "pointer-events": "none"
        }));
        labelLayer.appendChild(svgEl("text", {
          class: "map-label",
          x: labelX,
          y: labelY,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "pointer-events": "none",
          fill: active ? "#ffe7a8" : "#ffffff",
          stroke: "none",
          "font-size": String(labelSize),
          "font-weight": "800",
          "font-family": "Outfit, Inter, sans-serif"
        }, location.name));

        group.addEventListener("pointerenter", () => setHover(location.id));
        group.addEventListener("pointerleave", () => setHover(null));
        els.markers.appendChild(group);
      });
      els.markers.appendChild(labelLayer);
    }

    function renderPanel() {
      const selected = locations().find((item) => item.id === selectedId);
      if (!selected) {
        const list = filteredLocations();
        els.panel.innerHTML = `
          <div class="map-panel-head">
            <p class="eyebrow">Território</p>
            <h3>Escolha uma comunidade</h3>
            <p>Busque, filtre por região ou clique no mapa.</p>
            <label class="map-search">
              <span class="map-search-icon" aria-hidden="true">⌕</span>
              <span class="visually-hidden">Buscar comunidade</span>
              <input type="search" data-map-search-input placeholder="Buscar comunidade…" value="${escapeHTML(query)}" autocomplete="off">
            </label>
            <div class="map-chips" role="group" aria-label="Filtrar por região">
              ${REGIONS.map((item) => `<button type="button" class="map-chip ${item === region ? "active" : ""}" data-region="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join("")}
            </div>
          </div>
          <ul class="map-list">
            ${list.length ? list.map(({ location, count, investment }) => `
              <li>
                <button type="button" class="map-list-item ${hoveredId === location.id ? "is-active" : ""}" data-select="${escapeHTML(location.id)}">
                  <span class="map-list-pin" aria-hidden="true"></span>
                  <span class="map-list-copy"><strong>${escapeHTML(location.name)}</strong><small>${escapeHTML(location.region)}</small></span>
                  <span class="map-list-meta"><b>${count ? `${count} ${count === 1 ? "item" : "itens"}` : "Sem entregas"}</b><small>${investment ? formatCurrency(investment) : ""}</small></span>
                </button>
              </li>`).join("") : `<li class="map-empty">Nenhuma comunidade encontrada com esse filtro.</li>`}
          </ul>`;
        return;
      }

      const all = deliveriesFor(selected.id);
      const items = all.filter((item) => type === "Todos" || item.type === type);
      const investment = investmentFor(selected.id);
      const typeCount = (name) => all.filter((item) => item.type === name).length;
      els.panel.innerHTML = `
        <div class="map-panel-head is-place">
          <div class="map-place-bar">
            <button type="button" class="map-back" data-clear><span aria-hidden="true">←</span> Voltar à lista</button>
            <button type="button" class="icon-button map-close" data-clear aria-label="Limpar seleção">×</button>
          </div>
          <p class="eyebrow">${escapeHTML(selected.region)} · Itapajé</p>
          <h3>${escapeHTML(selected.name)}</h3>
          <div class="map-panel-meta">
            <span><small>Nesta comunidade</small><strong>${all.length} ${all.length === 1 ? "resultado" : "resultados"}</strong></span>
            ${investment ? `<span class="is-value"><small>Valor mapeado</small>${moneyMarkup(investment)}</span>` : ""}
          </div>
          <div class="map-chips" role="group" aria-label="Filtrar por tipo">
            ${["Todos", "Emenda", "Obra", "Projeto"].map((item) => {
              const label = item === "Emenda" ? "Emendas" : item === "Obra" ? "Obras" : item === "Projeto" ? "Projetos" : "Todos";
              const count = item === "Todos" ? all.length : typeCount(item);
              return `<button type="button" class="map-chip ${item === type ? "active" : ""}" data-type="${escapeHTML(item)}"><span>${label}</span><em>${count}</em></button>`;
            }).join("")}
          </div>
        </div>
        <div class="map-results">
          ${items.length ? items.map(renderCard).join("") : all.length
            ? `<p class="map-empty">Nenhum resultado neste filtro para ${escapeHTML(selected.name)}.</p>`
            : `<p class="map-empty">Nenhuma entrega cadastrada em ${escapeHTML(selected.name)} ainda. O ponto já está no mapa.</p>`}
        </div>`;
    }

    function renderCard(item) {
      const mediaKey = `${item.id}-media`;
      const open = expandedMedia === mediaKey;
      const video = youtubeId(item.video);
      const uniquePhotos = [...new Set([item.image, ...(item.photos || [])].filter(Boolean))];
      const cover = uniquePhotos[0]
        ? `<button type="button" class="map-card-cover" data-expand="${escapeHTML(mediaKey)}" aria-expanded="${open}"><img src="${escapeHTML(uniquePhotos[0])}" alt=""><span class="map-card-caption">Ver mídia</span></button>`
        : "";
      return `
        <article class="map-card">
          <div class="map-card-lead">
            <div class="map-card-top">
              <span class="tag">${escapeHTML(item.type)}</span>
              <span class="map-status map-status--${item.status === "Entregue" ? "done" : item.status === "Em andamento" ? "progress" : "plan"}">${escapeHTML(item.status)}</span>
            </div>
            <h4>${escapeHTML(item.title)}</h4>
            <p class="map-card-value"><small>Investimento</small>${moneyMarkup(item.value)}</p>
          </div>
          ${cover}
          <div class="map-card-body">
            <p>${escapeHTML(item.summary)}</p>
            ${uniquePhotos.length > 1 || video ? `
              <div class="map-media-row">
                ${video ? `<button type="button" class="map-thumb map-thumb-play" data-expand="${escapeHTML(mediaKey)}" aria-label="Abrir vídeo" aria-expanded="${open}">▶ Vídeo</button>` : ""}
                ${uniquePhotos.length > 1 ? `<button type="button" class="map-thumb-more" data-expand="${escapeHTML(mediaKey)}" aria-expanded="${open}">+${uniquePhotos.length - 1} fotos</button>` : ""}
              </div>
            ` : ""}
            ${open ? `<div class="map-media-expand">
              ${uniquePhotos.map((src) => `<img src="${escapeHTML(src)}" alt="">`).join("")}
              ${video ? `<iframe title="Vídeo da entrega" src="https://www.youtube-nocookie.com/embed/${escapeHTML(video)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>` : ""}
            </div>` : ""}
          </div>
        </article>`;
    }

    function render() {
      renderTotals();
      renderMarkers();
      renderPanel();
      if (els.hover) els.hover.textContent = hoverName();
      if (els.legendCurrent) {
        const selected = locations().find((item) => item.id === selectedId);
        els.legendCurrent.textContent = selected ? selected.name : "Nenhum ponto selecionado";
        els.legendCurrent.classList.toggle("is-on", Boolean(selected));
      }
    }

    function setHover(id) {
      hoveredId = id;
      if (els.hover) els.hover.textContent = hoverName();
      els.markers.querySelectorAll("[data-marker]").forEach((node) => {
        node.classList.toggle("is-active", node.getAttribute("data-marker") === hoveredId || node.getAttribute("data-marker") === selectedId);
      });
      root.querySelectorAll("[data-select]").forEach((node) => {
        node.classList.toggle("is-active", node.dataset.select === hoveredId);
      });
    }

    function select(id) {
      if (!id || !locations().some((item) => item.id === id)) return;
      selectedId = id;
      expandedMedia = null;
      type = "Todos";
      render();
      const card = els.panel.querySelector(".map-card, .map-empty");
      if (card) {
        card.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "nearest"
        });
      }
    }

    function clear() {
      selectedId = null;
      expandedMedia = null;
      type = "Todos";
      render();
    }

    function closestAttr(node, attr) {
      while (node && node !== root) {
        if (node.getAttribute?.(attr)) return node;
        node = node.parentElement || node.parentNode;
      }
      return null;
    }

    root.addEventListener("click", (event) => {
      const marker = closestAttr(event.target, "data-marker");
      if (marker) { select(marker.getAttribute("data-marker")); return; }
      const pick = event.target.closest?.("[data-select]");
      if (pick) { select(pick.dataset.select); return; }
      if (event.target.closest("[data-clear]")) { clear(); return; }
      const regionBtn = event.target.closest("[data-region]");
      if (regionBtn) { region = regionBtn.dataset.region; render(); return; }
      const typeBtn = event.target.closest("[data-type]");
      if (typeBtn) { type = typeBtn.dataset.type; render(); return; }
      const expand = event.target.closest("[data-expand]");
      if (expand) {
        expandedMedia = expandedMedia === expand.dataset.expand ? null : expand.dataset.expand;
        render();
      }
    });

    root.addEventListener("pointerover", (event) => {
      const item = event.target.closest("[data-select]");
      if (item) setHover(item.dataset.select);
    });

    root.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const marker = closestAttr(event.target, "data-marker");
      if (!marker) return;
      event.preventDefault();
      select(marker.getAttribute("data-marker"));
    });

    root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-map-search-input]")) return;
      query = event.target.value;
      const cursor = event.target.selectionStart;
      render();
      const input = els.panel.querySelector("[data-map-search-input]");
      if (!input) return;
      input.focus();
      const pos = Math.min(cursor ?? query.length, query.length);
      input.setSelectionRange(pos, pos);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (expandedMedia) { expandedMedia = null; render(); return; }
      if (selectedId) clear();
    });

    window.addEventListener("yuriMapaAtualizado", (event) => {
      state = event.detail || loadMapState();
      if (selectedId && !locations().some((item) => item.id === selectedId)) selectedId = null;
      render();
    });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
