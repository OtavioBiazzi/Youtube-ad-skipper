// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Popup Logic v3
// ══════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  skipDelay: 1,
  muteAds: true,
  showOverlay: true,
  aggressiveSkip: true,
};

// ── Elementos ────────────────────────────────────

const toggleEnabled = document.getElementById("toggle-enabled");
const toggleMute = document.getElementById("toggle-mute");
const toggleOverlay = document.getElementById("toggle-overlay");
const toggleAggressive = document.getElementById("toggle-aggressive");
const skipDelaySlider = document.getElementById("skip-delay");
const delayDisplay = document.getElementById("delay-display");
const delayHint = document.getElementById("delay-hint");
const statusDot = document.querySelector(".status-dot");
const statusText = document.getElementById("status-text");
const container = document.querySelector(".popup-container");

// ── Carregar configurações ───────────────────────

chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
  toggleEnabled.checked = settings.enabled;
  toggleMute.checked = settings.muteAds;
  toggleOverlay.checked = settings.showOverlay;
  toggleAggressive.checked = settings.aggressiveSkip;
  skipDelaySlider.value = settings.skipDelay;

  updateDelayDisplay(settings.skipDelay);
  updateStatusUI(settings.enabled);
  updateSliderTrack();
});

// ── Eventos ──────────────────────────────────────

toggleEnabled.addEventListener("change", () => {
  const enabled = toggleEnabled.checked;
  chrome.storage.local.set({ enabled });
  updateStatusUI(enabled);
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
  const delay = parseInt(skipDelaySlider.value);
  updateDelayDisplay(delay);
  updateSliderTrack();
  chrome.storage.local.set({ skipDelay: delay });
});

// ── UI Helpers ───────────────────────────────────

function updateDelayDisplay(delay) {
  delayDisplay.textContent = delay + "s";

  if (delay <= 3) {
    delayHint.textContent = `Espera ~${delay}s e depois pula`;
    delayHint.style.color = "#22c55e";
  } else if (delay <= 10) {
    delayHint.textContent = `Espera ~${delay}s e depois pula`;
    delayHint.style.color = "#eab308";
  } else {
    delayHint.textContent = `Espera ~${delay}s e depois pula`;
    delayHint.style.color = "#f97316";
  }
}

function updateSliderTrack() {
  const min = parseInt(skipDelaySlider.min);
  const max = parseInt(skipDelaySlider.max);
  const val = parseInt(skipDelaySlider.value);
  const progress = ((val - min) / (max - min)) * 100;
  skipDelaySlider.style.setProperty('--slider-progress', progress + '%');
  // Update the gradient background to show filled track
  skipDelaySlider.style.background = `linear-gradient(90deg, #ff2d55 0%, #ff4d3a ${progress}%, #1e1e22 ${progress}%)`;
}

function updateStatusUI(enabled) {
  if (enabled) {
    statusDot.classList.add("active");
    statusText.textContent = "Protegendo você";
    container.classList.remove("disabled");
  } else {
    statusDot.classList.remove("active");
    statusText.textContent = "Desativado";
    container.classList.add("disabled");
  }
}
