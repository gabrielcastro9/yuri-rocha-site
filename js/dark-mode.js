const STORAGE_KEY = "yfr-theme";
const root = document.documentElement;
const button = document.querySelector("[data-theme-toggle]");

function preferredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // O tema do sistema continua funcionando quando o armazenamento é bloqueado.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (button) {
    const dark = theme === "dark";
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute("aria-label", dark ? "Ativar tema claro" : "Ativar tema escuro");
    button.setAttribute("aria-pressed", String(dark));
  }
}

applyTheme(preferredTheme());
button?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // A preferência permanece ativa durante a sessão atual.
  }
  applyTheme(next);
});

const colorScheme = matchMedia("(prefers-color-scheme: dark)");
colorScheme.addEventListener?.("change", event => {
  let hasSavedTheme = false;
  try {
    hasSavedTheme = Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Sem armazenamento, acompanha o tema do sistema.
  }
  if (!hasSavedTheme) applyTheme(event.matches ? "dark" : "light");
});
