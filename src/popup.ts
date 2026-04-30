// ══════════════════════════════════════════════════
// Tube Shield — Popup Logic v3 | Taste Skill
// ══════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
  warningCount: 0,
  theme: 'dark',
};

// ── Elements ─────────────────────────────────────

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function query<T extends Element>(selector: string): T {
  return document.querySelector(selector) as T;
}

type PopupState = {
  enabled: boolean;
  skipDelay: number;
  muteAds: boolean;
  showOverlay: boolean;
  aggressiveSkip: boolean;
  theme?: string;
};

type PopupSettings = PopupState & {
  warningCount: number;
};

const toggleEnabled    = byId<HTMLInputElement>("toggle-enabled");
const toggleMute       = byId<HTMLInputElement>("toggle-mute");
const toggleOverlay    = byId<HTMLInputElement>("toggle-overlay");
const toggleAggressive = byId<HTMLInputElement>("toggle-aggressive");
const skipDelaySlider  = byId<HTMLInputElement>("skip-delay");
const delayDisplay     = byId<HTMLElement>("delay-display");
const delayHint        = byId<HTMLElement>("delay-hint");
const blockDelay       = byId<HTMLElement>("block-delay");
const statusPip        = query<HTMLElement>(".status-pip");
const statusLabel      = byId<HTMLElement>("status-text");
const container        = query<HTMLElement>(".popup-container");
const warningRow       = byId<HTMLElement>("warning-row");
const warningText      = byId<HTMLElement>("warning-text");
const versionTag       = byId<HTMLElement>("version-tag");
const stateIcons       = Array.from(document.querySelectorAll<HTMLImageElement>("[data-state-icon]"));

const notes = {
  enabled: document.getElementById("note-enabled"),
  skipDelay: document.getElementById("note-delay"),
  muteAds: document.getElementById("note-mute"),
  showOverlay: document.getElementById("note-overlay"),
  aggressiveSkip: document.getElementById("note-aggressive")
};

let initialState: Partial<PopupState> = {};

// ── Version ────────────────────────────────────────

try {
  const manifestVersion = chrome.runtime.getManifest().version;
  if (versionTag) versionTag.textContent = `v${manifestVersion}`;
} catch (err) {
  console.warn("[Tube Shield] Failed to read manifest version:", err);
  if (versionTag) versionTag.textContent = "v-";
}

// ── Load settings ────────────────────────────────

chrome.storage.local.get(DEFAULT_SETTINGS, (s: PopupSettings) => {
  toggleEnabled.checked    = s.enabled;
  toggleMute.checked       = s.muteAds;
  toggleOverlay.checked    = s.showOverlay;
  toggleAggressive.checked = s.aggressiveSkip;
  skipDelaySlider.value    = String(s.skipDelay);

  initialState = {
    enabled: s.enabled,
    skipDelay: s.skipDelay,
    muteAds: s.muteAds,
    showOverlay: s.showOverlay,
    aggressiveSkip: s.aggressiveSkip,
    theme: s.theme
  };

  applyTheme(s.theme);
  renderDelay(s.skipDelay);
  renderStatus(s.enabled);
  renderSliderTrack();
  renderAggressiveState(s.aggressiveSkip);
  renderWarnings(s.warningCount || 0);
});

// ── Events ───────────────────────────────────────

toggleEnabled.addEventListener("change", () => {
  const on = toggleEnabled.checked;
  chrome.storage.local.set({ enabled: on });
  renderStatus(on);
  checkChanges();
});

toggleMute.addEventListener("change", () => {
  chrome.storage.local.set({ muteAds: toggleMute.checked });
  checkChanges();
});

toggleOverlay.addEventListener("change", () => {
  chrome.storage.local.set({ showOverlay: toggleOverlay.checked });
  checkChanges();
});

toggleAggressive.addEventListener("change", () => {
  const on = toggleAggressive.checked;
  const nextSettings: Record<string, unknown> = { aggressiveSkip: on };
  if (!on) nextSettings.instantSkip = false;
  chrome.storage.local.set(nextSettings);
  renderAggressiveState(on);
  checkChanges();
});

skipDelaySlider.addEventListener("input", () => {
  const v = parseInt(skipDelaySlider.value, 10);
  renderDelay(v);
  renderSliderTrack();
  chrome.storage.local.set({ skipDelay: v });
  checkChanges();
});

function applyTheme(theme: string) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

// ── Render helpers ───────────────────────────────

function checkChanges() {
  if (!initialState || Object.keys(initialState).length === 0) return;

  const current: PopupState = {
    enabled: toggleEnabled.checked,
    skipDelay: parseInt(skipDelaySlider.value, 10),
    muteAds: toggleMute.checked,
    showOverlay: toggleOverlay.checked,
    aggressiveSkip: toggleAggressive.checked
  };

  for (const key of Object.keys(current) as Array<keyof PopupState>) {
    if (notes[key]) {
      notes[key].style.display = current[key] !== initialState[key] ? "block" : "none";
    }
  }
}

function renderDelay(seconds: number) {
  delayDisplay.textContent = seconds + "s";

  if (seconds <= 3) {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(152, 55%, 42%)";
  } else if (seconds <= 10) {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(45, 75%, 52%)";
  } else {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(25, 80%, 55%)";
  }
}

function renderSliderTrack() {
  const min = parseInt(skipDelaySlider.min, 10);
  const max = parseInt(skipDelaySlider.max, 10);
  const val = parseInt(skipDelaySlider.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  skipDelaySlider.style.background =
    "linear-gradient(90deg, var(--accent) " + pct + "%, var(--border) " + pct + "%)";
}

function renderStatus(enabled: boolean) {
  if (enabled) {
    statusPip.classList.add("active");
    statusLabel.textContent = "Ativo";
    container.classList.remove("disabled");
  } else {
    statusPip.classList.remove("active");
    statusLabel.textContent = "Desativado";
    container.classList.add("disabled");
  }
  renderStateIcons(enabled, toggleAggressive.checked);
}

function renderAggressiveState(on: boolean) {
  if (on) {
    blockDelay.classList.remove("block--disabled");
  } else {
    blockDelay.classList.add("block--disabled");
  }
  renderStateIcons(toggleEnabled.checked, on);
}

function getStateIconPath(enabled: boolean, aggressive: boolean) {
  if (!enabled) return "icon48_off.png";
  return aggressive ? "icon48.png" : "icon48_stealth.png";
}

function renderStateIcons(enabled: boolean, aggressive: boolean) {
  const path = getStateIconPath(enabled, aggressive);
  stateIcons.forEach((icon) => {
    icon.src = path;
  });
}

function renderWarnings(count: number) {
  if (count === 0) {
    warningRow.classList.remove("warning-row--alert");
    warningText.textContent = "Nenhum aviso do YouTube interceptado.";
  } else {
    warningRow.classList.add("warning-row--alert");
    warningText.textContent = count + " aviso" + (count > 1 ? "s" : "") + " do YouTube interceptado" + (count > 1 ? "s" : "") + " e bloqueado" + (count > 1 ? "s" : "") + ".";
  }
}

// ── Live sync ────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    toggleEnabled.checked = !!changes.enabled.newValue;
    renderStatus(!!changes.enabled.newValue);
  }
  if (changes.muteAds) toggleMute.checked = !!changes.muteAds.newValue;
  if (changes.showOverlay) toggleOverlay.checked = !!changes.showOverlay.newValue;
  if (changes.aggressiveSkip) {
    toggleAggressive.checked = !!changes.aggressiveSkip.newValue;
    renderAggressiveState(!!changes.aggressiveSkip.newValue);
  }
  if (changes.skipDelay) {
    const value = parseInt(String(changes.skipDelay.newValue), 10);
    if (!isNaN(value)) {
      skipDelaySlider.value = String(value);
      renderDelay(value);
      renderSliderTrack();
    }
  }
  if (changes.warningCount) {
    renderWarnings(Number(changes.warningCount.newValue) || 0);
  }
  if (changes.theme) {
    applyTheme(String(changes.theme.newValue));
  }
  checkChanges();
});

// ── Open settings page ──────────────────────────

byId<HTMLButtonElement>("btn-open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

byId<HTMLButtonElement>("btn-open-settings-main").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

export {};
