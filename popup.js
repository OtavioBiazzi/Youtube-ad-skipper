// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Popup Logic v3 | Taste Skill
// ══════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
};

// ── Elements ─────────────────────────────────────

const toggleEnabled    = document.getElementById("toggle-enabled");
const toggleMute       = document.getElementById("toggle-mute");
const toggleOverlay    = document.getElementById("toggle-overlay");
const toggleAggressive = document.getElementById("toggle-aggressive");
const skipDelaySlider  = document.getElementById("skip-delay");
const delayDisplay     = document.getElementById("delay-display");
const delayHint        = document.getElementById("delay-hint");
const statusPip        = document.querySelector(".status-pip");
const statusLabel      = document.getElementById("status-text");
const container        = document.querySelector(".popup-container");

// ── Load settings ────────────────────────────────

chrome.storage.local.get(DEFAULT_SETTINGS, (s) => {
  toggleEnabled.checked    = s.enabled;
  toggleMute.checked       = s.muteAds;
  toggleOverlay.checked    = s.showOverlay;
  toggleAggressive.checked = s.aggressiveSkip;
  skipDelaySlider.value    = s.skipDelay;

  renderDelay(s.skipDelay);
  renderStatus(s.enabled);
  renderSliderTrack();
});

// ── Events ───────────────────────────────────────

toggleEnabled.addEventListener("change", () => {
  const on = toggleEnabled.checked;
  chrome.storage.local.set({ enabled: on });
  renderStatus(on);
});

toggleMute.addEventListener("change", () => {
  chrome.storage.local.set({ muteAds: toggleMute.checked });
});

toggleOverlay.addEventListener("change", () => {
  chrome.storage.local.set({ showOverlay: toggleOverlay.checked });
});

toggleAggressive.addEventListener("change", () => {
  chrome.storage.local.set({ aggressiveSkip: toggleAggressive.checked });
});

skipDelaySlider.addEventListener("input", () => {
  const v = parseInt(skipDelaySlider.value, 10);
  renderDelay(v);
  renderSliderTrack();
  chrome.storage.local.set({ skipDelay: v });
});

// ── Render helpers ───────────────────────────────

function renderDelay(seconds) {
  delayDisplay.textContent = seconds + "s";

  // Dynamic hint color based on delay length
  if (seconds <= 3) {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(152, 55%, 42%)";      // green
  } else if (seconds <= 10) {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(45, 75%, 52%)";       // yellow
  } else {
    delayHint.textContent = "Espera ~" + seconds + "s e depois pula";
    delayHint.style.color = "hsl(25, 80%, 55%)";       // orange
  }
}

function renderSliderTrack() {
  const min = parseInt(skipDelaySlider.min, 10);
  const max = parseInt(skipDelaySlider.max, 10);
  const val = parseInt(skipDelaySlider.value, 10);
  const pct = ((val - min) / (max - min)) * 100;
  // Filled track via inline gradient
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
