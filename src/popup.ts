import { DEFAULT_SETTINGS, getSettingsMigrationPatch, migrateSettings } from "./shared/settings";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing popup element: #${id}`);
  return element as T;
}

type PopupSettings = {
  enabled: boolean;
  adSkipperEnabled: boolean;
  skipDelay: number;
  muteAds: boolean;
  showOverlay: boolean;
  aggressiveSkip: boolean;
  theme?: string;
  totalAdsSkipped: number;
  adsSkippedToday: number;
  warningCount: number;
};

const elements = {
  enabled: byId<HTMLInputElement>("toggle-enabled"),
  skipper: byId<HTMLInputElement>("toggle-ad-skipper"),
  aggressive: byId<HTMLInputElement>("toggle-aggressive"),
  mute: byId<HTMLInputElement>("toggle-mute"),
  overlay: byId<HTMLInputElement>("toggle-overlay"),
  delay: byId<HTMLInputElement>("skip-delay"),
  delayDisplay: byId<HTMLOutputElement>("delay-display"),
  delayHint: byId<HTMLElement>("delay-hint"),
  modeDescription: byId<HTMLElement>("mode-description"),
  statusTitle: byId<HTMLElement>("extension-status-title"),
  statusText: byId<HTMLElement>("status-text"),
  statusPip: document.querySelector<HTMLElement>(".status-pip")!,
  metricTotal: byId<HTMLElement>("metric-total"),
  metricToday: byId<HTMLElement>("metric-today"),
  metricWarnings: byId<HTMLElement>("metric-warnings"),
  warningText: byId<HTMLElement>("warning-text"),
  changeNote: byId<HTMLElement>("change-note"),
  version: byId<HTMLElement>("version-tag"),
  stateIcons: Array.from(document.querySelectorAll<HTMLImageElement>("[data-state-icon]")),
};

let noteTimer: number | null = null;

function announceChange(message = "Configuração aplicada ao YouTube.") {
  elements.changeNote.textContent = message;
  elements.changeNote.classList.add("is-visible");
  if (noteTimer) window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => elements.changeNote.classList.remove("is-visible"), 1800);
}

function applyTheme(theme: string | undefined) {
  document.body.classList.toggle("theme-light", theme === "light");
}

function renderDelay(seconds: number) {
  const value = Math.min(30, Math.max(1, Number(seconds) || 1));
  elements.delay.value = String(value);
  elements.delayDisplay.value = `${value}s`;
  elements.delayHint.textContent = value <= 3 ? "Rápido" : value <= 10 ? "Equilibrado" : "Conservador";
  const percentage = ((value - 1) / 29) * 100;
  elements.delay.style.setProperty("--range-progress", `${percentage}%`);
}

function renderStatus(enabled: boolean, skipperEnabled = elements.skipper.checked) {
  const active = enabled && skipperEnabled;
  elements.statusPip.classList.toggle("active", active);
  elements.statusTitle.textContent = enabled ? "Extensão ativa" : "Extensão pausada";
  elements.statusText.textContent = !enabled
    ? "Extensão pausada"
    : skipperEnabled
      ? "Monitorando o YouTube"
      : "Player ativo · skipper pausado";
  document.body.classList.toggle("extension-disabled", !enabled);
  const icon = !enabled ? "icon48_off.png" : elements.aggressive.checked ? "icon48.png" : "icon48_stealth.png";
  elements.stateIcons.forEach((image) => { image.src = icon; });
}

function renderMode(aggressive: boolean) {
  elements.modeDescription.textContent = aggressive
    ? "Botão nativo primeiro, aceleração como fallback"
    : "Aguarda apenas o botão nativo do YouTube";
  renderStatus(elements.enabled.checked, elements.skipper.checked);
}

function renderStats(total: number, today: number, warnings: number) {
  elements.metricTotal.textContent = String(Math.max(0, Number(total) || 0));
  elements.metricToday.textContent = String(Math.max(0, Number(today) || 0));
  elements.metricWarnings.textContent = String(Math.max(0, Number(warnings) || 0));
  elements.warningText.textContent = warnings > 0
    ? `${warnings} aviso${warnings === 1 ? "" : "s"} do YouTube tratado${warnings === 1 ? "" : "s"}.`
    : "Nenhum aviso interceptado.";
}

try {
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
} catch {
  elements.version.textContent = "v-";
}

chrome.storage.local.get(DEFAULT_SETTINGS, (settings: PopupSettings) => {
  // Persist the first-run/upgrade patch here too: otherwise a toggle changed
  // in the popup before YouTube is opened would be overwritten by it later.
  const migrationPatch = getSettingsMigrationPatch((settings as unknown as Record<string, unknown>).playerDefaultsProfileVersion);
  if (migrationPatch) chrome.storage.local.set(migrationPatch);
  settings = migrateSettings(settings as unknown as Record<string, unknown>) as unknown as PopupSettings;
  elements.enabled.checked = settings.enabled;
  elements.skipper.checked = settings.adSkipperEnabled !== false;
  elements.aggressive.checked = settings.aggressiveSkip;
  elements.mute.checked = settings.muteAds;
  elements.overlay.checked = settings.showOverlay;
  applyTheme(settings.theme);
  renderDelay(settings.skipDelay);
  renderMode(settings.aggressiveSkip);
  renderStatus(settings.enabled, settings.adSkipperEnabled !== false);
  renderStats(settings.totalAdsSkipped, settings.adsSkippedToday, settings.warningCount);
});

elements.enabled.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: elements.enabled.checked });
  renderStatus(elements.enabled.checked);
  announceChange(elements.enabled.checked ? "Extensão ativada." : "Extensão pausada.");
});

elements.skipper.addEventListener("change", () => {
  chrome.storage.local.set({ adSkipperEnabled: elements.skipper.checked });
  renderStatus(elements.enabled.checked, elements.skipper.checked);
  announceChange(elements.skipper.checked ? "Ad Skipper ativado." : "Ad Skipper pausado.");
});

elements.aggressive.addEventListener("change", () => {
  const aggressiveSkip = elements.aggressive.checked;
  const updates: Record<string, boolean> = aggressiveSkip
    ? { aggressiveSkip }
    : { aggressiveSkip, instantSkip: false };
  chrome.storage.local.set(updates);
  renderMode(aggressiveSkip);
  announceChange(aggressiveSkip ? "Modo acelerado ativado." : "Modo seguro ativado.");
});

elements.mute.addEventListener("change", () => {
  chrome.storage.local.set({ muteAds: elements.mute.checked });
  announceChange();
});

elements.overlay.addEventListener("change", () => {
  chrome.storage.local.set({ showOverlay: elements.overlay.checked });
  announceChange();
});

elements.delay.addEventListener("input", () => {
  const skipDelay = Number(elements.delay.value);
  renderDelay(skipDelay);
  chrome.storage.local.set({ skipDelay });
});

elements.delay.addEventListener("change", () => announceChange(`Tempo para pular: ${elements.delay.value}s.`));

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) elements.enabled.checked = !!changes.enabled.newValue;
  if (changes.adSkipperEnabled) elements.skipper.checked = changes.adSkipperEnabled.newValue !== false;
  if (changes.aggressiveSkip) {
    elements.aggressive.checked = !!changes.aggressiveSkip.newValue;
    renderMode(elements.aggressive.checked);
  }
  if (changes.muteAds) elements.mute.checked = !!changes.muteAds.newValue;
  if (changes.showOverlay) elements.overlay.checked = !!changes.showOverlay.newValue;
  if (changes.skipDelay) renderDelay(Number(changes.skipDelay.newValue));
  if (changes.theme) applyTheme(String(changes.theme.newValue));
  renderStatus(elements.enabled.checked, elements.skipper.checked);

  if (changes.totalAdsSkipped || changes.adsSkippedToday || changes.warningCount) {
    chrome.storage.local.get(DEFAULT_SETTINGS, (settings: PopupSettings) => {
      renderStats(settings.totalAdsSkipped, settings.adsSkippedToday, settings.warningCount);
    });
  }
});

for (const id of ["btn-open-settings", "btn-open-settings-main"]) {
  byId<HTMLButtonElement>(id).addEventListener("click", () => chrome.runtime.openOptionsPage());
}

export {};

// ── Generic quick toggles (data-popup-setting) ──────────────

const POPUP_SETTING_MESSAGES: Record<string, [string, string]> = {
  miniplayerEnabled: ["Miniplayer ativado.", "Miniplayer desativado."],
  resumePlaybackEnabled: ["Vídeos vão continuar de onde pararam.", "Continuar de onde parou desativado."],
  liveCatchUpEnabled: ["Lives sem atraso: acelera de leve quando atrasar.", "Lives no ritmo normal."],
  skipSurveysEnabled: ["Pesquisas serão puladas automaticamente.", "Pesquisas não serão puladas."],
};

const popupSettingInputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-popup-setting]"));
chrome.storage.local.get(DEFAULT_SETTINGS, (settings: Record<string, unknown>) => {
  const migrated = migrateSettings(settings) as Record<string, unknown>;
  popupSettingInputs.forEach((input) => {
    const key = input.dataset.popupSetting || "";
    input.checked = migrated[key] !== false && !!migrated[key];
  });
});
popupSettingInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.dataset.popupSetting || "";
    if (!key) return;
    chrome.storage.local.set({ [key]: input.checked });
    const [on, off] = POPUP_SETTING_MESSAGES[key] || ["Configuração aplicada.", "Configuração aplicada."];
    announceChange(input.checked ? on : off);
  });
});

// ── Where the player buttons live (segmented: Dentro / Fora / Off) ──────────

const placementButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-placement]"));

function renderPlacement(inside: boolean, below: boolean) {
  const current = inside ? "inside" : below ? "below" : "off";
  placementButtons.forEach((button) => button.setAttribute("aria-checked", String(button.dataset.placement === current)));
}

chrome.storage.local.get(DEFAULT_SETTINGS, (settings: Record<string, unknown>) => {
  const migrated = migrateSettings(settings) as Record<string, unknown>;
  renderPlacement(migrated.playerControlsEnabled !== false, migrated.toolbarEnabled !== false);
});

placementButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.placement;
    const inside = value === "inside";
    const below = value === "below";
    chrome.storage.local.set({ playerControlsEnabled: inside, toolbarEnabled: below });
    renderPlacement(inside, below);
    announceChange(inside ? "Botões dentro do player." : below ? "Botões numa barra abaixo do vídeo." : "Botões escondidos.");
  });
});

// ── Visual of the in-player buttons (A/B: separate pill or divider) ─────────

const styleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-controls-style]"));
const styleRow = document.getElementById("style-row");

function renderControlsStyle(style: string, inside: boolean) {
  const current = style === "divider" ? "divider" : "pill";
  styleButtons.forEach((button) => button.setAttribute("aria-checked", String(button.dataset.controlsStyle === current)));
  if (styleRow) styleRow.hidden = !inside;
}

chrome.storage.local.get(DEFAULT_SETTINGS, (settings: Record<string, unknown>) => {
  const migrated = migrateSettings(settings) as Record<string, unknown>;
  renderControlsStyle(String(migrated.playerControlsStyle), migrated.playerControlsEnabled !== false);
});

styleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const style = button.dataset.controlsStyle === "divider" ? "divider" : "pill";
    chrome.storage.local.set({ playerControlsStyle: style });
    renderControlsStyle(style, true);
    announceChange(style === "pill" ? "Botões numa caixa própria." : "Botões junto com os do YouTube.");
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (!changes.playerControlsEnabled && !changes.playerControlsStyle) return;
  chrome.storage.local.get(DEFAULT_SETTINGS, (settings: Record<string, unknown>) => {
    const migrated = migrateSettings(settings) as Record<string, unknown>;
    renderControlsStyle(String(migrated.playerControlsStyle), migrated.playerControlsEnabled !== false);
  });
});

// ── Update check: shows a download link when GitHub has a newer release ──

const RELEASES_API = "https://api.github.com/repos/OtavioBiazzi/Youtube-ad-skipper/releases/latest";

function isNewerVersion(latest: string, current: string) {
  const a = latest.replace(/^v/, "").split(".").map(Number);
  const b = current.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

(async () => {
  try {
    const current = chrome.runtime.getManifest().version;
    const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) return;
    const release = await response.json();
    const tag = String(release.tag_name || "");
    if (!tag || !isNewerVersion(tag, current)) return;
    const asset = Array.isArray(release.assets) ? release.assets.find((a: any) => String(a.name).endsWith(".zip")) : null;
    const banner = document.getElementById("update-banner") as HTMLAnchorElement | null;
    const label = document.getElementById("update-version");
    if (!banner || !label) return;
    banner.href = asset?.browser_download_url || release.html_url;
    label.textContent = tag + " ↓";
    banner.hidden = false;
  } catch (err) {}
})();
