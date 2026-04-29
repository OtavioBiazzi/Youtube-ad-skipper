// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Options Logic | Taste Skill
// ══════════════════════════════════════════════════

type ListMode = 'whitelist' | 'blacklist';

type OptionsSettings = {
  enabled: boolean;
  skipDelay: number;
  muteAds: boolean;
  showOverlay: boolean;
  aggressiveSkip: boolean;
  warningCount: number;
  theme: string;
  totalAdsSkipped: number;
  adsSkippedToday: number;
  todayDate: string | null;
  whitelist: string[];
  listMode: ListMode;
  showToast: boolean;
  shortcutEnabled: boolean;
  instantSkip: boolean;
  pipEnabled: boolean;
  adSpeedRate: number;
};

const DEFAULT: OptionsSettings = {
  enabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
  warningCount: 0,
  theme: 'dark',
  totalAdsSkipped: 0,
  adsSkippedToday: 0,
  todayDate: null,
  whitelist: [],
  listMode: 'whitelist',
  showToast: false,
  shortcutEnabled: false,
  instantSkip: false,
  pipEnabled: false,
  adSpeedRate: 3,
};

const SAFE_AD_SPEED_RATE = 3;
const MIN_AD_SPEED_RATE = 1;
const MAX_AD_SPEED_RATE = 8;
const INSTANT_AD_SPEED_RATE = 16;

// ── Elements ─────────────────────────────────────

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const optEnabled    = byId<HTMLInputElement>("opt-enabled");
const optMute       = byId<HTMLInputElement>("opt-mute");
const optOverlay    = byId<HTMLInputElement>("opt-overlay");
const optAggressive = byId<HTMLInputElement>("opt-aggressive");
const optDelay      = byId<HTMLInputElement>("opt-delay");
const timingCard    = byId<HTMLElement>("timing-card");
const delayControl  = byId<HTMLElement>("delay-control");
const themeToggle   = byId<HTMLButtonElement>("theme-toggle");
const delayValue    = byId<HTMLElement>("opt-delay-value");
const delayHint     = byId<HTMLElement>("opt-delay-hint");
const statTotal     = byId<HTMLElement>("stat-total");
const statToday     = byId<HTMLElement>("stat-today");
const statWarnings  = byId<HTMLElement>("stat-warnings");
const stealthBadge  = byId<HTMLElement>("stealth-mode-badge");

const warningBox    = byId<HTMLElement>("warning-box");
const warningText   = byId<HTMLElement>("warning-text");
const versionTag    = byId<HTMLElement>("version-tag");
const btnReset      = byId<HTMLButtonElement>("btn-reset");
const stateIcons    = Array.from(document.querySelectorAll<HTMLImageElement>("[data-state-icon]"));

const whitelistInput  = byId<HTMLInputElement>("whitelist-input");
const whitelistAddBtn = byId<HTMLButtonElement>("whitelist-add");
const whitelistList   = byId<HTMLElement>("whitelist-list");
const whitelistEmpty  = byId<HTMLElement>("whitelist-empty");

const optListMode = byId<HTMLInputElement>("opt-list-mode");
const listModeLabel = byId<HTMLElement>("list-mode-label");

const optToast    = byId<HTMLInputElement>("opt-toast");
const optShortcut = byId<HTMLInputElement>("opt-shortcut");
const optInstant  = byId<HTMLInputElement>("opt-instant");
const optPip      = byId<HTMLInputElement>("opt-pip");
const optAdSpeed  = byId<HTMLInputElement>("opt-ad-speed");
const adSpeedControl = byId<HTMLElement>("ad-speed-control");
const adSpeedValue = byId<HTMLElement>("opt-ad-speed-value");
const f5Banner    = byId<HTMLElement>("f5-banner");

let currentWhitelist: string[] = [];
let initialState: OptionsSettings | null = null;

// ── Load ─────────────────────────────────────────

chrome.storage.local.get(DEFAULT, (s: OptionsSettings) => {
  initialState = JSON.parse(JSON.stringify(s));

  optEnabled.checked    = s.enabled;
  optMute.checked       = s.muteAds;
  optOverlay.checked    = s.showOverlay;
  optAggressive.checked = s.aggressiveSkip;
  optDelay.value        = String(s.skipDelay);
  
  optToast.checked      = !!s.showToast;
  optShortcut.checked   = !!s.shortcutEnabled;
  optInstant.checked    = !!s.instantSkip;
  optPip.checked        = !!s.pipEnabled;
  optAdSpeed.value      = String(normalizeAdSpeed(s.adSpeedRate));
  optListMode.checked   = s.listMode === 'blacklist';

  applyTheme(s.theme);
  renderStatus(s.enabled);
  renderWarnings(s.warningCount || 0);
  renderMode(s.aggressiveSkip);
  renderStateIcons(s.enabled, s.aggressiveSkip);
  renderListMode(s.listMode || 'whitelist');
  renderTimingControls();
  
  // Stats
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const todayCount = s.todayDate === today ? (s.adsSkippedToday || 0) : 0;
  
  animateCounter(statTotal, s.totalAdsSkipped || 0);
  animateCounter(statToday, todayCount);
  
  // Whitelist
  currentWhitelist = Array.isArray(s.whitelist) ? [...s.whitelist] : [];
  renderWhitelist();
});

// Get version from manifest
try {
  versionTag.textContent = "v" + chrome.runtime.getManifest().version;
} catch (err) {
  console.warn("[YouTube Ad Skipper] Failed to read manifest version:", err);
  versionTag.textContent = "v-";
}

// ── Events ───────────────────────────────────────

optEnabled.addEventListener("change", () => {
  const on = optEnabled.checked;
  chrome.storage.local.set({ enabled: on });
  renderStatus(on);
});

themeToggle.addEventListener("click", () => {
  const isLight = document.body.classList.contains('theme-light');
  const theme = isLight ? 'dark' : 'light';
  chrome.storage.local.set({ theme });
  applyTheme(theme);
});

function applyTheme(theme: string) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

optMute.addEventListener("change", () => {
  chrome.storage.local.set({ muteAds: optMute.checked });
});

optOverlay.addEventListener("change", () => {
  chrome.storage.local.set({ showOverlay: optOverlay.checked });
});

optAggressive.addEventListener("change", () => {
  const on = optAggressive.checked;
  chrome.storage.local.set({ aggressiveSkip: on });
  renderMode(on);
  renderTimingControls();
});

optDelay.addEventListener("input", () => {
  const v = parseInt(optDelay.value, 10);
  chrome.storage.local.set({ skipDelay: v });
  renderTimingControls();
});

optListMode.addEventListener("change", () => {
  const mode = optListMode.checked ? 'blacklist' : 'whitelist';
  chrome.storage.local.set({ listMode: mode });
  renderListMode(mode);
});

optToast.addEventListener("change", () => {
  chrome.storage.local.set({ showToast: optToast.checked });
});

optShortcut.addEventListener("change", () => {
  chrome.storage.local.set({ shortcutEnabled: optShortcut.checked });
});

optInstant.addEventListener("change", () => {
  chrome.storage.local.set({ instantSkip: optInstant.checked });
  renderTimingControls();
});

optPip.addEventListener("change", () => {
  chrome.storage.local.set({ pipEnabled: optPip.checked });
});

optAdSpeed.addEventListener("input", () => {
  const value = normalizeAdSpeed(optAdSpeed.value);
  chrome.storage.local.set({ adSpeedRate: value });
  renderTimingControls();
});

btnReset.addEventListener("click", () => {
  if (confirm("Isso vai resetar todas as configurações e zerar o contador de anúncios e avisos. Continuar?")) {
    chrome.storage.local.set(DEFAULT, () => {
      location.reload();
    });
  }
});

// ── Whitelist Logic ───────────────────────────────

function renderWhitelist() {
  whitelistList.innerHTML = "";

  if (currentWhitelist.length === 0) {
    whitelistEmpty.style.display = "block";
    return;
  }

  whitelistEmpty.style.display = "none";

  currentWhitelist.forEach((name, i) => {
    const item = document.createElement("div");
    item.className = "whitelist-item";
    item.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="whitelist-remove" data-index="${i}" title="Remover">✕</button>
    `;
    whitelistList.appendChild(item);
  });

  whitelistList.querySelectorAll(".whitelist-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt((btn as HTMLElement).dataset.index || "0", 10);
      currentWhitelist.splice(idx, 1);
      chrome.storage.local.set({ whitelist: currentWhitelist });
      renderWhitelist();
    });
  });
}

function addWhitelistEntry() {
  const name = whitelistInput.value.trim();
  if (!name) return;

  if (currentWhitelist.some(w => w.toLowerCase() === name.toLowerCase())) {
    whitelistInput.value = "";
    flashBorder(whitelistInput, "var(--orange)");
    return;
  }

  currentWhitelist.push(name);
  chrome.storage.local.set({ whitelist: currentWhitelist });
  whitelistInput.value = "";
  renderWhitelist();
}

whitelistAddBtn.addEventListener("click", addWhitelistEntry);
whitelistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWhitelistEntry();
});

function escapeHtml(str: string) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function flashBorder(el: HTMLElement, color: string) {
  const orig = el.style.borderColor;
  el.style.borderColor = color;
  setTimeout(() => { el.style.borderColor = orig; }, 600);
}

// ── Render ────────────────────────────────────────

function renderDelay(v: number, aggressive: boolean, instant: boolean) {
  delayValue.textContent = String(instant ? 0 : v);
  if (!aggressive) {
    delayHint.textContent = "Modo agressivo desligado: aguarda o botão de pular aparecer naturalmente.";
    delayHint.style.color = "hsl(45, 75%, 52%)";
  } else if (instant) {
    delayHint.textContent = "Pulo instantâneo ativo: usa 0s e aceleração máxima.";
    delayHint.style.color = "hsl(0, 72%, 58%)";
  } else if (v <= 3) {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio.";
    delayHint.style.color = "hsl(152, 55%, 42%)";
  } else if (v <= 10) {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio.";
    delayHint.style.color = "hsl(45, 75%, 52%)";
  } else {
    delayHint.textContent = "Espera ~" + v + "s e depois pula o anúncio. Delay alto pode causar experiência lenta.";
    delayHint.style.color = "hsl(25, 80%, 55%)";
  }
}

function renderSlider() {
  const min = parseInt(optDelay.min, 10);
  const max = parseInt(optDelay.max, 10);
  const val = parseInt(optDelay.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  optDelay.style.background = "linear-gradient(90deg, hsl(355,65%,52%) " + pct + "%, #1c1c1f " + pct + "%)";
}

function renderStatus(enabled: boolean) {
  document.body.classList.toggle("extension-disabled", !enabled);
  renderStateIcons(enabled, optAggressive.checked);
}

function renderMode(aggressive: boolean) {
  if (stealthBadge) {
    stealthBadge.textContent = aggressive ? "AGRESSIVO" : "SEGURO/FURTIVO";
    stealthBadge.style.background = aggressive ? "var(--accent-dim)" : "var(--green-dim)";
    stealthBadge.style.color = aggressive ? "var(--accent)" : "var(--green)";
  }
  renderStateIcons(optEnabled.checked, aggressive);
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

function renderListMode(mode: ListMode) {
  if (!listModeLabel) return;
  if (mode === 'blacklist') {
    listModeLabel.textContent = "Blacklist";
    listModeLabel.style.color = "var(--green)";
  } else {
    listModeLabel.textContent = "Whitelist";
    listModeLabel.style.color = "var(--accent)";
  }
}

function normalizeAdSpeed(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return SAFE_AD_SPEED_RATE;
  return Math.min(MAX_AD_SPEED_RATE, Math.max(MIN_AD_SPEED_RATE, n));
}

function getTimingState() {
  const aggressive = optAggressive.checked;
  const instant = aggressive && optInstant.checked;
  return {
    aggressive,
    instant,
    locked: !aggressive || instant,
  };
}

function formatSpeed(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1) + "x";
}

function renderTimingControls() {
  const delay = parseInt(optDelay.value, 10) || DEFAULT.skipDelay;
  const speed = normalizeAdSpeed(optAdSpeed.value);
  const state = getTimingState();

  optDelay.disabled = state.locked;
  optAdSpeed.disabled = state.locked;
  timingCard.classList.toggle("card--locked", state.locked);
  delayControl.classList.toggle("control-locked", state.locked);
  adSpeedControl.classList.toggle("control-locked", state.locked);

  renderDelay(delay, state.aggressive, state.instant);
  renderSlider();
  renderAdSpeed(speed, state.instant);
}

function renderAdSpeed(value: number, instant = false) {
  const speed = instant ? INSTANT_AD_SPEED_RATE : normalizeAdSpeed(value);
  const isRisk = speed > SAFE_AD_SPEED_RATE;
  adSpeedValue.textContent = instant ? formatSpeed(speed) + " max" : formatSpeed(speed);
  adSpeedValue.classList.toggle("tag--safe", !isRisk);
  adSpeedValue.classList.toggle("tag--risk", isRisk);
  const min = parseFloat(optAdSpeed.min);
  const max = parseFloat(optAdSpeed.max);
  const visualSpeed = instant ? max : speed;
  const pct = ((visualSpeed - min) / (max - min)) * 100;
  optAdSpeed.style.background = "linear-gradient(90deg, hsl(355,65%,52%) " + pct + "%, #1c1c1f " + pct + "%)";
}

function animateCounter(el: HTMLElement, target: number) {
  if (!el) return;
  if (target === 0) { el.textContent = "0"; return; }
  const duration = 600;
  const start = performance.now();

  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString("pt-BR");
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderWarnings(count: number) {
  statWarnings.textContent = String(count);

  if (count === 0) {
    warningBox.classList.remove("warning-box--alert");
    warningText.textContent = "Nenhum aviso do YouTube interceptado.";
  } else {
    warningBox.classList.add("warning-box--alert");
    warningText.textContent = count + " aviso" + (count > 1 ? "s" : "") + " do YouTube interceptado" + (count > 1 ? "s" : "") + " e bloqueado" + (count > 1 ? "s" : "") + ".";
  }
}

// ── Live Sync ────────────────────────────────────

function checkRestartWarning() {
  if (!initialState) return;
  chrome.storage.local.get(DEFAULT, (current: OptionsSettings) => {
    const needsReload: Array<keyof OptionsSettings> = ['enabled', 'skipDelay', 'muteAds', 'showOverlay', 'aggressiveSkip', 'listMode', 'instantSkip', 'pipEnabled', 'adSpeedRate'];
    let changed = false;
    
    for (const key of needsReload) {
      if (current[key] !== initialState[key]) { changed = true; break; }
    }
    
    if (!changed && JSON.stringify(current.whitelist) !== JSON.stringify(initialState.whitelist)) {
      changed = true;
    }

    const initialSpeed = normalizeAdSpeed(initialState.adSpeedRate);
    const currentSpeed = normalizeAdSpeed(current.adSpeedRate);
    const riskySpeedChange = (
      (current.instantSkip && current.aggressiveSkip && current.instantSkip !== initialState.instantSkip) ||
      (currentSpeed > SAFE_AD_SPEED_RATE && currentSpeed !== initialSpeed)
    );
    renderRestartBanner(changed, riskySpeedChange);
  });
}

function renderRestartBanner(visible: boolean, riskySpeedChange: boolean) {
  if (!f5Banner) return;
  f5Banner.style.display = visible ? "block" : "none";
  f5Banner.classList.toggle("f5-banner--danger", riskySpeedChange);
  f5Banner.textContent = riskySpeedChange
    ? "Recarregue os vídeos do YouTube (F5) para aplicar. Aceleração acima de 3x pode aumentar o risco de identificação."
    : "Configurações alteradas! Recarregue os vídeos do YouTube (F5) para aplicar.";
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    optEnabled.checked = !!changes.enabled.newValue;
    renderStatus(!!changes.enabled.newValue);
  }
  if (changes.muteAds) optMute.checked = !!changes.muteAds.newValue;
  if (changes.showOverlay) optOverlay.checked = !!changes.showOverlay.newValue;
  if (changes.skipDelay) {
    const value = parseInt(String(changes.skipDelay.newValue), 10);
    if (!isNaN(value)) {
      optDelay.value = String(value);
      renderTimingControls();
    }
  }
  if (changes.warningCount) renderWarnings(Number(changes.warningCount.newValue) || 0);
  if (changes.aggressiveSkip) {
    optAggressive.checked = !!changes.aggressiveSkip.newValue;
    renderMode(!!changes.aggressiveSkip.newValue);
    renderTimingControls();
  }
  if (changes.theme) applyTheme(String(changes.theme.newValue));
  if (changes.listMode) {
    const mode: ListMode = changes.listMode.newValue === 'blacklist' ? 'blacklist' : 'whitelist';
    optListMode.checked = mode === 'blacklist';
    renderListMode(mode);
  }
  if (changes.showToast) optToast.checked = !!changes.showToast.newValue;
  if (changes.shortcutEnabled) optShortcut.checked = !!changes.shortcutEnabled.newValue;
  if (changes.instantSkip) {
    optInstant.checked = !!changes.instantSkip.newValue;
    renderTimingControls();
  }
  if (changes.pipEnabled) optPip.checked = !!changes.pipEnabled.newValue;
  if (changes.adSpeedRate) {
    const value = normalizeAdSpeed(changes.adSpeedRate.newValue);
    optAdSpeed.value = String(value);
    renderTimingControls();
  }
  
  if (changes.totalAdsSkipped) {
    animateCounter(statTotal, Number(changes.totalAdsSkipped.newValue) || 0);
  }
  if (changes.adsSkippedToday) {
    animateCounter(statToday, Number(changes.adsSkippedToday.newValue) || 0);
  }
  if (changes.whitelist) {
    currentWhitelist = Array.isArray(changes.whitelist.newValue) ? [...changes.whitelist.newValue] : [];
    renderWhitelist();
  }
  
  checkRestartWarning();
});

export {};
