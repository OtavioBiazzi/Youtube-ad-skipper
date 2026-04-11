// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Popup Logic v2
// ══════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  skipDelay: 0,
  muteAds: true,
  showOverlay: true,
  adsSkipped: 0,
  timeSaved: 0,
};

// ── Elementos ────────────────────────────────────

const toggleEnabled = document.getElementById("toggle-enabled");
const toggleMute = document.getElementById("toggle-mute");
const toggleOverlay = document.getElementById("toggle-overlay");
const skipDelaySlider = document.getElementById("skip-delay");
const delayDisplay = document.getElementById("delay-display");
const delayHint = document.getElementById("delay-hint");
const statusDot = document.querySelector(".status-dot");
const statusText = document.getElementById("status-text");
const statSkipped = document.getElementById("stat-skipped");
const statTime = document.getElementById("stat-time");
const resetBtn = document.getElementById("reset-stats");
const container = document.querySelector(".popup-container");

// ── Carregar configurações ───────────────────────

chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
  toggleEnabled.checked = settings.enabled;
  toggleMute.checked = settings.muteAds;
  toggleOverlay.checked = settings.showOverlay;
  skipDelaySlider.value = settings.skipDelay;

  updateDelayDisplay(settings.skipDelay);
  updateStatusUI(settings.enabled);
  updateStats(settings.adsSkipped, settings.timeSaved);
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

skipDelaySlider.addEventListener("input", () => {
  const delay = parseInt(skipDelaySlider.value);
  updateDelayDisplay(delay);
  chrome.storage.local.set({ skipDelay: delay });
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Tem certeza que deseja resetar todas as suas estatísticas de anúncios pulados?")) {
    return;
  }
  chrome.storage.local.set({ adsSkipped: 0, timeSaved: 0 });
  updateStats(0, 0);

  resetBtn.textContent = "✓ Resetado!";
  resetBtn.style.color = "#22c55e";
  resetBtn.style.borderColor = "rgba(34, 197, 94, 0.3)";
  setTimeout(() => {
    resetBtn.textContent = "Resetar Estatísticas";
    resetBtn.style.color = "";
    resetBtn.style.borderColor = "";
  }, 1500);
});

// ── UI Helpers ───────────────────────────────────

function updateDelayDisplay(delay) {
  delayDisplay.textContent = delay + "s";

  if (delay === 0) {
    delayHint.textContent = "Pula instantaneamente";
    delayHint.style.color = "#22c55e";
  } else if (delay <= 5) {
    delayHint.textContent = `Espera ${delay}s e depois pula`;
    delayHint.style.color = "#eab308";
  } else {
    delayHint.textContent = `Espera ${delay}s e depois pula`;
    delayHint.style.color = "#f97316";
  }
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

function updateStats(skipped, timeSaved) {
  statSkipped.textContent = skipped;
  statTime.textContent = formatTime(timeSaved);
}

function formatTime(totalSeconds) {
  if (totalSeconds < 60) return Math.round(totalSeconds) + "s";
  if (totalSeconds < 3600) {
    const min = Math.floor(totalSeconds / 60);
    const sec = Math.round(totalSeconds % 60);
    return min + "m " + sec + "s";
  }
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.round((totalSeconds % 3600) / 60);
  return hrs + "h " + min + "m";
}

// ── Sync em tempo real ───────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.adsSkipped) statSkipped.textContent = changes.adsSkipped.newValue;
  if (changes.timeSaved) statTime.textContent = formatTime(changes.timeSaved.newValue);
});
