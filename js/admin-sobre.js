(() => {
  "use strict";

  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const ICONS = [
    ["infra", "Infraestrutura"],
    ["saude", "Saúde e Educação"],
    ["desenvolvimento", "Desenvolvimento"]
  ];

  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value = "") => (window.YuriAdmin?.escapeHTML || ((text) => String(text)))(value);

  let page = null;
  let uploadedPhoto = "";

  function notify(text, type = "success") {
    const element = $("#global-message");
    if (!element) return;
    element.hidden = false;
    element.textContent = text;
    element.className = `message toast-message ${type === "error" ? "error" : "success"}`;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => { element.hidden = true; }, 5000);
  }

  function blank(kind) {
    if (kind === "facts") return { value: "", label: "" };
    if (kind === "steps") return { kicker: "", title: "", text: "" };
    return { icon: "infra", title: "", text: "" };
  }

  function readLists() {
    page.facts = [...document.querySelectorAll("[data-fact]")].map((node) => ({
      value: node.querySelector("[data-value]").value,
      label: node.querySelector("[data-label]").value
    }));
    page.steps = [...document.querySelectorAll("[data-step]")].map((node) => ({
      kicker: node.querySelector("[data-kicker]").value,
      title: node.querySelector("[data-title]").value,
      text: node.querySelector("[data-text]").value
    }));
    page.fronts = [...document.querySelectorAll("[data-front]")].map((node) => ({
      icon: node.querySelector("[data-icon]").value,
      title: node.querySelector("[data-title]").value,
      text: node.querySelector("[data-text]").value
    }));
  }

  function renderPhoto() {
    const info = $("#photo-info");
    info.innerHTML = uploadedPhoto
      ? `<img class="upload-thumb" src="${escapeHTML(uploadedPhoto)}" alt="Foto enviada"><span>Foto pronta para a página.</span><button type="button" data-clear-photo>Remover</button>`
      : "";
  }

  function renderList(kind) {
    const root = $(`#${kind}-list`);
    const items = page[kind];
    root.innerHTML = items.map((item, index) => {
      if (kind === "facts") {
        return `<div class="sobre-item" data-fact>
          <div class="sobre-item-bar"><strong>Fato ${index + 1}</strong><button class="button button-secondary" type="button" data-remove="${kind}" data-index="${index}">Remover</button></div>
          <div class="field"><label>Destaque</label><input data-value maxlength="80" value="${escapeHTML(item.value)}"></div>
          <div class="field"><label>Legenda</label><input data-label maxlength="80" value="${escapeHTML(item.label)}"></div>
        </div>`;
      }
      if (kind === "steps") {
        return `<div class="sobre-item" data-step>
          <div class="sobre-item-bar"><strong>Etapa ${index + 1}</strong><button class="button button-secondary" type="button" data-remove="${kind}" data-index="${index}">Remover</button></div>
          <div class="field"><label>Rótulo</label><input data-kicker maxlength="40" value="${escapeHTML(item.kicker)}"></div>
          <div class="field"><label>Título</label><input data-title maxlength="80" value="${escapeHTML(item.title)}"></div>
          <div class="field"><label>Texto</label><textarea data-text rows="3" maxlength="400">${escapeHTML(item.text)}</textarea></div>
        </div>`;
      }
      const options = ICONS.map(([value, label]) =>
        `<option value="${value}" ${item.icon === value ? "selected" : ""}>${label}</option>`
      ).join("");
      return `<div class="sobre-item" data-front>
        <div class="sobre-item-bar"><strong>Frente ${index + 1}</strong><button class="button button-secondary" type="button" data-remove="${kind}" data-index="${index}">Remover</button></div>
        <div class="field"><label>Ícone</label><select data-icon>${options}</select></div>
        <div class="field"><label>Título</label><input data-title maxlength="80" value="${escapeHTML(item.title)}"></div>
        <div class="field"><label>Texto</label><textarea data-text rows="3" maxlength="400">${escapeHTML(item.text)}</textarea></div>
      </div>`;
    }).join("") || `<p class="muted">Nenhum item. Use o botão acima para adicionar.</p>`;
  }

  function fill() {
    $("#hero-eyebrow").value = page.heroEyebrow;
    $("#hero-title").value = page.heroTitle;
    $("#hero-lead").value = page.heroLead;
    $("#photo-alt").value = page.photoAlt;
    $("#photo-caption").value = page.photoCaption;
    const hosted = page.photo.startsWith("/uploads/") || page.photo.includes("blob.vercel-storage.com");
    uploadedPhoto = hosted ? page.photo : "";
    $("#photo-url").value = hosted ? "" : page.photo;
    $("#journey-eyebrow").value = page.journeyEyebrow;
    $("#journey-title").value = page.journeyTitle;
    $("#journey-lead").value = page.journeyLead;
    $("#mandate-eyebrow").value = page.mandateEyebrow;
    $("#mandate-title").value = page.mandateTitle;
    $("#mandate-lead").value = page.mandateLead;
    renderPhoto();
    renderList("facts");
    renderList("steps");
    renderList("fronts");
  }

  function collect() {
    readLists();
    return {
      ...page,
      heroEyebrow: $("#hero-eyebrow").value,
      heroTitle: $("#hero-title").value,
      heroLead: $("#hero-lead").value,
      photo: uploadedPhoto || $("#photo-url").value.trim(),
      photoAlt: $("#photo-alt").value,
      photoCaption: $("#photo-caption").value,
      journeyEyebrow: $("#journey-eyebrow").value,
      journeyTitle: $("#journey-title").value,
      journeyLead: $("#journey-lead").value,
      mandateEyebrow: $("#mandate-eyebrow").value,
      mandateTitle: $("#mandate-title").value,
      mandateLead: $("#mandate-lead").value
    };
  }

  async function uploadFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) throw new Error("Use JPEG, PNG, WebP ou GIF.");
    if (file.size > MAX_FILE_SIZE) throw new Error("A imagem deve ter no máximo 2 MB.");
    const form = new FormData();
    form.append("file", file);
    return (await window.YuriAdmin.api("/api/upload", { method: "POST", body: form })).url;
  }

  async function boot() {
    const data = await window.YuriAdmin.api("/api/sobre");
    page = data.page;
    fill();
  }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    boot().catch((error) => notify(error.message, "error"));
  };
  window.addEventListener("yfr-admin-ready", start, { once: true });
  if (window.YuriAdmin?.ready) start();

  $("#sobre-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("[form='sobre-form']");
    if (button) button.disabled = true;
    try {
      const data = await window.YuriAdmin.api("/api/sobre", {
        method: "PUT",
        body: JSON.stringify({ page: collect() })
      });
      page = data.page;
      fill();
      notify("Página Sobre salva. Já está no site público.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add && page) {
      readLists();
      const kind = add.dataset.add;
      const limit = kind === "fronts" ? 6 : 8;
      if (page[kind].length >= limit) {
        notify(`O limite é ${limit} itens.`, "error");
        return;
      }
      page[kind].push(blank(kind));
      renderList(kind);
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove && page) {
      readLists();
      page[remove.dataset.remove].splice(Number(remove.dataset.index), 1);
      renderList(remove.dataset.remove);
      return;
    }
    if (event.target.closest("[data-clear-photo]")) {
      uploadedPhoto = "";
      const input = $("#photo-upload");
      if (input) input.value = "";
      renderPhoto();
    }
  });

  $("#photo-url")?.addEventListener("input", () => {
    if ($("#photo-url").value.trim() && uploadedPhoto) {
      uploadedPhoto = "";
      const input = $("#photo-upload");
      if (input) input.value = "";
      renderPhoto();
    }
  });

  $("#photo-upload")?.addEventListener("change", async () => {
    const file = $("#photo-upload").files[0];
    if (!file) return;
    try {
      uploadedPhoto = await uploadFile(file);
      $("#photo-url").value = "";
      renderPhoto();
    } catch (error) {
      $("#photo-upload").value = "";
      notify(error.message, "error");
    }
  });
})();
