/**
 * CRUD do mapa de Itapajé no painel. Dados em /api/mapa.
 */
(() => {
  "use strict";

  if (document.body?.dataset.adminPage !== "mapa") return;

  window.addEventListener("yfr-admin-ready", start, { once: true });

  function start() {
  if (!window.YuriMapa) return;

  const {
    REGIONS,
    loadMapState, upsertLocation, removeLocation, upsertDelivery,
    removeDelivery, resetMapState, formatCurrency
  } = window.YuriMapa;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));

  const regions = REGIONS.filter((item) => item !== "Todas");
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_DELIVERY_PHOTOS = 8;
  let pending = null;
  let uploadedCover = "";
  let uploadedPhotos = [];

  const els = {
    locBody: $("#map-locations-body"),
    locEmpty: $("#map-locations-empty"),
    delBody: $("#map-deliveries-body"),
    delEmpty: $("#map-deliveries-empty"),
    locEditor: $("#mapa-ponto"),
    delEditor: $("#mapa-entrega"),
    locForm: $("#location-form"),
    delForm: $("#delivery-form"),
    locTitle: $("#location-editor-title"),
    delTitle: $("#delivery-editor-title"),
    search: $("#map-delivery-search"),
    typeFilter: $("#map-type-filter"),
    confirm: $("#map-confirm-dialog"),
    confirmTitle: $("#map-confirm-title"),
    confirmText: $("#map-confirm-text"),
    message: $("#global-message"),
    picker: $("#map-picker")
  };

  function toast(text, type = "success") {
    if (!els.message) return;
    els.message.textContent = text;
    els.message.className = `message toast-message ${type}`;
    els.message.hidden = false;
    window.setTimeout(() => { els.message.hidden = true; }, 4500);
  }

  function locationName(state, id) {
    return state.locations.find((item) => item.id === id)?.name || "Ponto removido";
  }

  function fillRegionSelect(selected = "Sede") {
    const select = $("#location-region");
    select.innerHTML = regions.map((item) => `<option ${item === selected ? "selected" : ""}>${escapeHTML(item)}</option>`).join("");
  }

  function fillLocationSelect(state, selected = "") {
    const select = $("#delivery-location");
    const options = state.locations
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `<option value="${escapeHTML(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHTML(item.name)}</option>`)
      .join("");
    select.innerHTML = `<option value="">Selecione</option>${options}`;
  }

  function currentPickerPoint() {
    return {
      lon: Number($("#location-lon").value) || -39.586,
      lat: Number($("#location-lat").value) || -3.686
    };
  }

  function renderPicker() {
    const box = els.picker;
    if (!box || !window.YuriMapa) return;
    const { VIEW_BOX, OUTLINE_PATH, project } = window.YuriMapa;
    const point = currentPickerPoint();
    const pos = project(point.lon, point.lat);
    box.hidden = false;
    box.innerHTML = `
      <svg viewBox="${VIEW_BOX}" role="img" aria-label="Clique para posicionar o ponto em Itapajé">
        <path d="${OUTLINE_PATH}" fill="#0d4f99" stroke="#061b3a" stroke-width="3" stroke-linejoin="round"></path>
        <circle class="picker-pin" cx="${pos.x}" cy="${pos.y}" r="9" fill="#e5c77e" stroke="#fff" stroke-width="2"></circle>
      </svg>`;
  }

  function pickerToLonLat(event) {
    const svg = els.picker?.querySelector("svg");
    if (!svg || !window.YuriMapa?.unproject) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const loc = point.matrixTransform(ctm.inverse());
    return window.YuriMapa.unproject(loc.x, loc.y);
  }

  function render() {
    const state = loadMapState();
    const counts = Object.fromEntries(state.locations.map((item) => [
      item.id,
      state.deliveries.filter((entry) => entry.locationId === item.id).length
    ]));
    const withWork = state.locations.filter((item) => counts[item.id] > 0).length;

    $("#map-metric-locations").textContent = String(state.locations.length);
    $("#map-metric-active").textContent = String(withWork);
    $("#map-metric-items").textContent = String(state.deliveries.length);

    els.locBody.innerHTML = state.locations
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `
        <tr>
          <td><strong>${escapeHTML(item.name)}</strong>${item.visible === false ? "<small> Oculto</small>" : ""}</td>
          <td>${escapeHTML(item.region)}</td>
          <td><small>${Number(item.lon).toFixed(4)}, ${Number(item.lat).toFixed(4)}</small></td>
          <td>${counts[item.id] || 0}</td>
          <td><div class="row-actions">
            <button class="row-action" type="button" data-edit-location="${escapeHTML(item.id)}" title="Editar">✎</button>
            <button class="row-action delete" type="button" data-delete-location="${escapeHTML(item.id)}" title="Excluir">⌫</button>
          </div></td>
        </tr>`).join("");
    els.locEmpty.hidden = state.locations.length > 0;

    const query = (els.search?.value || "").trim().toLocaleLowerCase("pt-BR");
    const type = els.typeFilter?.value || "";
    const filtered = state.deliveries.filter((item) => {
      if (type && item.type !== type) return false;
      if (!query) return true;
      return `${item.title} ${locationName(state, item.locationId)}`.toLocaleLowerCase("pt-BR").includes(query);
    });

    els.delBody.innerHTML = filtered.map((item) => `
      <tr>
        <td><strong>${escapeHTML(item.title)}</strong><small>${item.demo ? "Demonstrativo · " : ""}${formatCurrency(item.value)}</small></td>
        <td>${escapeHTML(locationName(state, item.locationId))}</td>
        <td>${escapeHTML(item.type)}</td>
        <td><span class="badge ${item.status === "Entregue" ? "badge-published" : item.status === "Em andamento" ? "badge-draft" : "badge-draft"}">${escapeHTML(item.status)}</span></td>
        <td><div class="row-actions">
          <button class="row-action" type="button" data-edit-delivery="${escapeHTML(item.id)}" title="Editar">✎</button>
          <button class="row-action delete" type="button" data-delete-delivery="${escapeHTML(item.id)}" title="Excluir">⌫</button>
        </div></td>
      </tr>`).join("");
    els.delEmpty.hidden = filtered.length > 0;
  }

  function openLocation(item = null) {
    els.locForm.reset();
    $("#location-id").value = item?.id || "";
    $("#location-name").value = item?.name || "";
    fillRegionSelect(item?.region || "Sede");
    $("#location-visible").checked = item ? item.visible !== false : true;
    $("#location-lon").value = item?.lon ?? -39.586;
    $("#location-lat").value = item?.lat ?? -3.686;
    $("#location-dx").value = item?.labelDx || 0;
    $("#location-dy").value = item?.labelDy || 0;
    els.locTitle.textContent = item ? "Editar ponto" : "Novo ponto";
    els.delEditor.hidden = true;
    els.locEditor.hidden = false;
    renderPicker();
    els.locEditor.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("#location-name").focus();
  }

  function hostedImage(src = "") {
    return /^data:image\//.test(src) || src.startsWith("/uploads/") || src.includes("blob.vercel-storage.com");
  }

  function photoUrls() {
    return $("#delivery-photos").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  function renderDeliveryMedia() {
    const coverBox = $("#delivery-image-preview");
    if (coverBox) {
      coverBox.innerHTML = uploadedCover
        ? `<img class="upload-thumb" src="${escapeHTML(uploadedCover)}" alt="Capa enviada"><span>Capa pronta para o mapa.</span><button type="button" data-clear-delivery-cover>Remover</button>`
        : "";
    }
    const list = $("#delivery-photos-preview");
    if (list) {
      list.innerHTML = uploadedPhotos.map((src, index) =>
        `<span class="file-chip file-chip-thumb"><img src="${escapeHTML(src)}" alt=""><span>Imagem ${index + 1}</span><button type="button" data-remove-delivery-photo="${index}" aria-label="Remover imagem ${index + 1}">×</button></span>`
      ).join("");
    }
  }

  async function uploadFile(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error(`${file.name}: formato não permitido.`);
    if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: o limite é 2 MB.`);
    const form = new FormData();
    form.append("file", file);
    return (await window.YuriAdmin.api("/api/upload", { method: "POST", body: form })).url;
  }

  function openDelivery(item = null) {
    const state = loadMapState();
    if (!state.locations.length) {
      toast("Crie um ponto no mapa antes de cadastrar uma entrega.", "error");
      return;
    }
    els.delForm.reset();
    $("#delivery-id").value = item?.id || "";
    $("#delivery-title").value = item?.title || "";
    fillLocationSelect(state, item?.locationId || "");
    $("#delivery-type").value = item?.type || "Projeto";
    $("#delivery-status").value = item?.status || "Planejado";
    $("#delivery-date").value = item?.date || "";
    $("#delivery-value").value = item?.value || "";
    $("#delivery-demo").checked = item ? item.demo !== false : true;
    $("#delivery-summary").value = item?.summary || "";
    const image = item?.image || "";
    uploadedCover = hostedImage(image) ? image : "";
    $("#delivery-image").value = uploadedCover ? "" : image;
    const photos = item?.photos || [];
    uploadedPhotos = photos.filter(hostedImage);
    $("#delivery-photos").value = photos.filter((src) => !hostedImage(src)).join("\n");
    $("#delivery-image-file").value = "";
    $("#delivery-photos-file").value = "";
    $("#delivery-video").value = item?.video || "";
    renderDeliveryMedia();
    els.delTitle.textContent = item ? "Editar entrega" : "Nova entrega";
    els.locEditor.hidden = true;
    els.delEditor.hidden = false;
    els.delEditor.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    $("#delivery-title").focus();
  }

  function askDelete(kind, id, title) {
    pending = { kind, id };
    els.confirmTitle.textContent = `Excluir “${title}”?`;
    els.confirmText.textContent = kind === "location"
      ? "O ponto e todas as entregas vinculadas saem do mapa público."
      : "A entrega deixa de aparecer no mapa público.";
    if (typeof els.confirm.showModal === "function") els.confirm.showModal();
    else els.confirm.setAttribute("open", "");
  }

  $$("[data-new-location]").forEach((button) => button.addEventListener("click", () => openLocation()));
  $("[data-new-delivery]")?.addEventListener("click", () => openDelivery());

  $("#delivery-image")?.addEventListener("input", () => {
    if ($("#delivery-image").value.trim() && uploadedCover) {
      uploadedCover = "";
      renderDeliveryMedia();
    }
  });

  $("#delivery-image-file")?.addEventListener("change", async () => {
    const input = $("#delivery-image-file");
    const file = input.files?.[0];
    if (!file) return;
    try {
      uploadedCover = await uploadFile(file);
      $("#delivery-image").value = "";
      input.value = "";
      renderDeliveryMedia();
    } catch (error) {
      input.value = "";
      toast(error.message, "error");
    }
  });

  $("#delivery-photos-file")?.addEventListener("change", async () => {
    const input = $("#delivery-photos-file");
    const files = [...(input.files || [])];
    if (!files.length) return;
    if (files.length + uploadedPhotos.length + photoUrls().length > MAX_DELIVERY_PHOTOS) {
      input.value = "";
      toast(`As fotos extras aceitam no máximo ${MAX_DELIVERY_PHOTOS} imagens no total.`, "error");
      return;
    }
    try {
      uploadedPhotos.push(...await Promise.all(files.map(uploadFile)));
      input.value = "";
      renderDeliveryMedia();
    } catch (error) {
      input.value = "";
      toast(error.message, "error");
    }
  });

  $("#delivery-image-preview")?.addEventListener("click", (event) => {
    if (!event.target.closest("[data-clear-delivery-cover]")) return;
    uploadedCover = "";
    renderDeliveryMedia();
  });

  $("#delivery-photos-preview")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-delivery-photo]");
    if (!button) return;
    uploadedPhotos.splice(Number(button.dataset.removeDeliveryPhoto), 1);
    renderDeliveryMedia();
  });
  $$("[data-close-location]").forEach((button) => button.addEventListener("click", () => { els.locEditor.hidden = true; }));
  $$("[data-close-delivery]").forEach((button) => button.addEventListener("click", () => { els.delEditor.hidden = true; }));

  els.picker?.addEventListener("click", (event) => {
    const coords = pickerToLonLat(event);
    if (!coords) return;
    $("#location-lon").value = coords.lon.toFixed(4);
    $("#location-lat").value = coords.lat.toFixed(4);
    renderPicker();
  });

  ["location-lon", "location-lat"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", renderPicker);
  });

  els.locForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#location-name").value.trim();
    const lon = Number($("#location-lon").value);
    const lat = Number($("#location-lat").value);
    if (!name || Number.isNaN(lon) || Number.isNaN(lat)) {
      toast("Preencha nome, longitude e latitude.", "error");
      return;
    }
    try {
      await upsertLocation({
        id: $("#location-id").value || undefined,
        name,
        region: $("#location-region").value,
        lon,
        lat,
        visible: $("#location-visible").checked,
        labelDx: Number($("#location-dx").value) || 0,
        labelDy: Number($("#location-dy").value) || 0
      });
      els.locEditor.hidden = true;
      render();
      toast("Ponto salvo. Ele já aparece no mapa público.");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  els.delForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("#delivery-title").value.trim();
    const locationId = $("#delivery-location").value;
    const summary = $("#delivery-summary").value.trim();
    if (!title || !locationId || !summary) {
      toast("Preencha título, comunidade e resumo.", "error");
      return;
    }
    try {
      await upsertDelivery({
        id: $("#delivery-id").value || undefined,
        locationId,
        type: $("#delivery-type").value,
        title,
        summary,
        value: Number($("#delivery-value").value) || 0,
        status: $("#delivery-status").value,
        date: $("#delivery-date").value,
        image: uploadedCover || $("#delivery-image").value.trim(),
        video: $("#delivery-video").value.trim(),
        photos: [...photoUrls(), ...uploadedPhotos],
        demo: $("#delivery-demo").checked
      });
      els.delEditor.hidden = true;
      render();
      toast("Entrega salva no mapa público.");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  els.locBody?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-location]");
    const remove = event.target.closest("[data-delete-location]");
    const state = loadMapState();
    if (edit) {
      const item = state.locations.find((entry) => entry.id === edit.dataset.editLocation);
      if (item) openLocation(item);
    }
    if (remove) {
      const item = state.locations.find((entry) => entry.id === remove.dataset.deleteLocation);
      if (item) askDelete("location", item.id, item.name);
    }
  });

  els.delBody?.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-delivery]");
    const remove = event.target.closest("[data-delete-delivery]");
    const state = loadMapState();
    if (edit) {
      const item = state.deliveries.find((entry) => entry.id === edit.dataset.editDelivery);
      if (item) openDelivery(item);
    }
    if (remove) {
      const item = state.deliveries.find((entry) => entry.id === remove.dataset.deleteDelivery);
      if (item) askDelete("delivery", item.id, item.title);
    }
  });

  $("[data-cancel-map-delete]")?.addEventListener("click", () => {
    pending = null;
    els.confirm.close?.() || els.confirm.removeAttribute("open");
  });

  $("[data-confirm-map-delete]")?.addEventListener("click", async () => {
    if (!pending) return;
    try {
      if (pending.kind === "location") await removeLocation(pending.id);
      else await removeDelivery(pending.id);
      pending = null;
      els.confirm.close?.() || els.confirm.removeAttribute("open");
      els.locEditor.hidden = true;
      els.delEditor.hidden = true;
      render();
      toast("Item removido do mapa.");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("[data-reset-map]")?.addEventListener("click", async () => {
    if (!window.confirm("Isso substitui os pontos atuais pelos exemplos de demonstração. Continuar?")) return;
    try {
      await resetMapState();
      els.locEditor.hidden = true;
      els.delEditor.hidden = true;
      render();
      toast("Mapa restaurado com os pontos de exemplo.");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  [els.search, els.typeFilter].forEach((input) => input?.addEventListener("input", render));
  window.addEventListener("yuriMapaAtualizado", render);

  fillRegionSelect();
  render();
  }
})();
