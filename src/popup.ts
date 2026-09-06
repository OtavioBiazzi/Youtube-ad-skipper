import { DEFAULT_SETTINGS, migrateSettings } from "./shared/settings";

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
  updateStatus: byId<HTMLElement>("update-status"),
  checkUpdate: byId<HTMLButtonElement>("check-update"),
  resetStats: byId<HTMLButtonElement>("btn-reset-stats"),
  version: byId<HTMLElement>("version-tag"),
  stateIcons: Array.from(document.querySelectorAll<HTMLImageElement>("[data-state-icon]")),
};

let noteTimer: number | null = null;
const RELEASE_API = "https://api.github.com/repos/OtavioBiazzi/Youtube-ad-skipper/releases/latest";

function compareVersions(left: string, right: string) {
  const parse = (value: string) => value.replace(/^v/i, "").split(".").map((part) => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}

async function checkForUpdate() {
  elements.checkUpdate.disabled = true;
  elements.updateStatus.textContent = "Verificando...";
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json() as { tag_name?: string; html_url?: string; assets?: Array<{ name?: string; browser_download_url?: string }> };
    const latest = String(release.tag_name || "");
    const current = chrome.runtime.getManifest().version;
    if (latest && compareVersions(latest, current) > 0) {
      elements.updateStatus.textContent = `Nova versao ${latest} disponivel.`;
      elements.checkUpdate.textContent = "Baixar";
      const downloadUrl = release.assets?.find((asset) => asset.name?.endsWith(".zip"))?.browser_download_url || release.html_url || "https://github.com/OtavioBiazzi/Youtube-ad-skipper/releases";
      elements.checkUpdate.onclick = () => window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      elements.updateStatus.textContent = `Voce esta na versao atual (${current}).`;
      elements.checkUpdate.textContent = "Atualizado";
    }
  } catch (error) {
    elements.updateStatus.textContent = "Nao foi possivel verificar agora.";
    elements.checkUpdate.textContent = "Tentar novamente";
  } finally {
    elements.checkUpdate.disabled = false;
  }
}

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
  settings = migrateSettings(settings) as unknown as PopupSettings;
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

elements.checkUpdate.addEventListener("click", checkForUpdate);

elements.resetStats.addEventListener("click", () => {
  if (!window.confirm("Zerar somente as estatisticas de anuncios?")) return;
  chrome.storage.local.set({ totalAdsSkipped: 0, adsSkippedToday: 0, todayDate: null }, () => {
    renderStats(0, 0, Number(elements.metricWarnings.textContent) || 0);
    announceChange("Contador de anuncios zerado.");
  });
});

export {};
