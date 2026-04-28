// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Options Logic | Taste Skill
// ══════════════════════════════════════════════════

const DEFAULT = {
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
};

// ── Elements ─────────────────────────────────────

const optEnabled    = document.getElementById("opt-enabled");
const optMute       = document.getElementById("opt-mute");
const optOverlay    = document.getElementById("opt-overlay");
const optAggressive = document.getElementById("opt-aggressive");
const optDelay      = document.getElementById("opt-delay");
const themeToggle   = document.getElementById("theme-toggle");
const delayValue    = document.getElementById("opt-delay-value");
const delayHint     = document.getElementById("opt-delay-hint");
const statTotal     = document.getElementById("stat-total");
const statToday     = document.getElementById("stat-today");
const statWarnings  = document.getElementById("stat-warnings");
const stealthBadge  = document.getElementById("stealth-mode-badge");

const warningBox    = document.getElementById("warning-box");
const warningText   = document.getElementById("warning-text");
const versionTag    = document.getElementById("version-tag");
const btnReset      = document.getElementById("btn-reset");
const aggressiveHint = document.getElementById("aggressive-hint");

const whitelistInput  = document.getElementById("whitelist-input");
const whitelistAddBtn = document.getElementById("whitelist-add");
const whitelistList   = document.getElementById("whitelist-list");
const whitelistEmpty  = document.getElementById("whitelist-empty");

const optListMode = document.getElementById("opt-list-mode");
const listModeLabel = document.getElementById("list-mode-label");

const optToast    = document.getElementById("opt-toast");
const optShortcut = document.getElementById("opt-shortcut");
const optInstant  = document.getElementById("opt-instant");
const optPip      = document.getElementById("opt-pip");
const f5Banner    = document.getElementById("f5-banner");

let currentWhitelist = [];
let initialState = null;

// ── Load ─────────────────────────────────────────

chrome.storage.local.get(DEFAULT, (s) => {
  initialState = JSON.parse(JSON.stringify(s));

  optEnabled.checked    = s.enabled;
  optMute.checked       = s.muteAds;
  optOverlay.checked    = s.showOverlay;
  optAggressive.checked = s.aggressiveSkip;
  optDelay.value        = s.skipDelay;
  
  optToast.checked      = !!s.showToast;
  optShortcut.checked   = !!s.shortcutEnabled;
  optInstant.checked    = !!s.instantSkip;
  optPip.checked        = !!s.pipEnabled;
  optListMode.checked   = s.listMode === 'blacklist';

  applyTheme(s.theme);
  renderStatus(s.enabled);
  renderDelay(s.skipDelay);
  renderWarnings(s.warningCount || 0);
  renderMode(s.aggressiveSkip);
  renderListMode(s.listMode || 'whitelist');
  renderSlider();
  
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

function applyTheme(theme) {
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
});

optDelay.addEventListener("input", () => {
  const v = parseInt(optDelay.value, 10);
  chrome.storage.local.set({ skipDelay: v });
  renderDelay(v);
  renderSlider();
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
});

optPip.addEventListener("change", () => {
  chrome.storage.local.set({ pipEnabled: optPip.checked });
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
      const idx = parseInt(btn.dataset.index, 10);
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function flashBorder(el, color) {
  const orig = el.style.borderColor;
  el.style.borderColor = color;
  setTimeout(() => { el.style.borderColor = orig; }, 600);
}

// ── Render ────────────────────────────────────────

function renderDelay(v) {
  delayValue.textContent = v;
  if (v <= 3) {
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

function renderStatus(enabled) {
  document.body.classList.toggle("extension-disabled", !enabled);
}

function renderMode(aggressive) {
  if (stealthBadge) {
    stealthBadge.textContent = aggressive ? "AGRESSIVO" : "SEGURO/FURTIVO";
    stealthBadge.style.background = aggressive ? "var(--accent-dim)" : "var(--green-dim)";
    stealthBadge.style.color = aggressive ? "var(--accent)" : "var(--green)";
  }
}

function renderListMode(mode) {
  if (!listModeLabel) return;
  if (mode === 'blacklist') {
    listModeLabel.textContent = "Blacklist";
    listModeLabel.style.color = "var(--green)";
  } else {
    listModeLabel.textContent = "Whitelist";
    listModeLabel.style.color = "var(--accent)";
  }
}

function animateCounter(el, target) {
  if (!el) return;
  if (target === 0) { el.textContent = "0"; return; }
  const duration = 600;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString("pt-BR");
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderWarnings(count) {
  statWarnings.textContent = count;

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
  chrome.storage.local.get(DEFAULT, (current) => {
    const needsReload = ['enabled', 'skipDelay', 'muteAds', 'showOverlay', 'aggressiveSkip', 'listMode', 'instantSkip', 'pipEnabled'];
    let changed = false;
    
    for (const key of needsReload) {
      if (current[key] !== initialState[key]) { changed = true; break; }
    }
    
    if (!changed && JSON.stringify(current.whitelist) !== JSON.stringify(initialState.whitelist)) {
      changed = true;
    }
    
    if (f5Banner) {
      f5Banner.style.display = changed ? "block" : "none";
    }
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    optEnabled.checked = !!changes.enabled.newValue;
    renderStatus(!!changes.enabled.newValue);
  }
  if (changes.muteAds) optMute.checked = !!changes.muteAds.newValue;
  if (changes.showOverlay) optOverlay.checked = !!changes.showOverlay.newValue;
  if (changes.skipDelay) {
    const value = parseInt(changes.skipDelay.newValue, 10);
    if (!isNaN(value)) {
      optDelay.value = value;
      renderDelay(value);
      renderSlider();
    }
  }
  if (changes.warningCount) renderWarnings(changes.warningCount.newValue || 0);
  if (changes.aggressiveSkip) {
    optAggressive.checked = !!changes.aggressiveSkip.newValue;
    renderMode(!!changes.aggressiveSkip.newValue);
  }
  if (changes.theme) applyTheme(changes.theme.newValue);
  if (changes.listMode) {
    const mode = changes.listMode.newValue === 'blacklist' ? 'blacklist' : 'whitelist';
    optListMode.checked = mode === 'blacklist';
    renderListMode(mode);
  }
  if (changes.showToast) optToast.checked = !!changes.showToast.newValue;
  if (changes.shortcutEnabled) optShortcut.checked = !!changes.shortcutEnabled.newValue;
  if (changes.instantSkip) optInstant.checked = !!changes.instantSkip.newValue;
  if (changes.pipEnabled) optPip.checked = !!changes.pipEnabled.newValue;
  
  if (changes.totalAdsSkipped) {
    animateCounter(statTotal, changes.totalAdsSkipped.newValue || 0);
  }
  if (changes.adsSkippedToday) {
    animateCounter(statToday, changes.adsSkippedToday.newValue || 0);
  }
  if (changes.whitelist) {
    currentWhitelist = Array.isArray(changes.whitelist.newValue) ? [...changes.whitelist.newValue] : [];
    renderWhitelist();
  }
  
  checkRestartWarning();
});
