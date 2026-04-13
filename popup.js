// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Popup Logic v3 | Taste Skill
// ══════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
  warningCount: 0,
};

// ── Elements ─────────────────────────────────────

const toggleEnabled    = document.getElementById("toggle-enabled");
const toggleMute       = document.getElementById("toggle-mute");
const toggleOverlay    = document.getElementById("toggle-overlay");
const toggleAggressive = document.getElementById("toggle-aggressive");
const skipDelaySlider  = document.getElementById("skip-delay");
const delayDisplay     = document.getElementById("delay-display");
const delayHint        = document.getElementById("delay-hint");
const globalNote       = document.getElementById("global-note");
const blockDelay       = document.getElementById("block-delay");
const statusPip        = document.querySelector(".status-pip");
const statusLabel      = document.getElementById("status-text");
const container        = document.querySelector(".popup-container");
const warningRow       = document.getElementById("warning-row");
const warningText      = document.getElementById("warning-text");

let initialState = {};

// ── Load settings ────────────────────────────────

chrome.storage.local.get(DEFAULT_SETTINGS, (s) => {
  toggleEnabled.checked    = s.enabled;
  toggleMute.checked       = s.muteAds;
  toggleOverlay.checked    = s.showOverlay;
  toggleAggressive.checked = s.aggressiveSkip;
  skipDelaySlider.value    = s.skipDelay;

  initialState = {
    enabled: s.enabled,
    skipDelay: s.skipDelay,
    muteAds: s.muteAds,
    showOverlay: s.showOverlay,
    aggressiveSkip: s.aggressiveSkip
  };

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
  chrome.storage.local.set({ aggressiveSkip: on });
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

// ── Render helpers ───────────────────────────────

function checkChanges() {
  if (!initialState || Object.keys(initialState).length === 0) return;

  const current = {
    enabled: toggleEnabled.checked,
    skipDelay: parseInt(skipDelaySlider.value, 10),
    muteAds: toggleMute.checked,
    showOverlay: toggleOverlay.checked,
    aggressiveSkip: toggleAggressive.checked
  };

  let changed = false;
  for (const key in current) {
    if (current[key] !== initialState[key]) {
      changed = true;
      break;
    }
  }

  if (changed) {
    globalNote.style.display = "block";
  } else {
    globalNote.style.display = "none";
  }
}

function renderDelay(seconds) {
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
    "linear-gradient(90deg, hsl(355,65%,52%) " + pct + "%, #1c1c1f " + pct + "%)";
}

function renderStatus(enabled) {
  if (enabled) {
    statusPip.classList.add("active");
    statusLabel.textContent = "Ativo";
    container.classList.remove("disabled");
  } else {
    statusPip.classList.remove("active");
    statusLabel.textContent = "Desativado";
    container.classList.add("disabled");
  }
}

function renderAggressiveState(on) {
  if (on) {
    blockDelay.classList.remove("block--disabled");
  } else {
    blockDelay.classList.add("block--disabled");
  }
}

function renderWarnings(count) {
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
  if (changes.warningCount) {
    renderWarnings(changes.warningCount.newValue || 0);
  }
});
