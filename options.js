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
};

// ── Elements ─────────────────────────────────────

const optEnabled    = document.getElementById("opt-enabled");
const optMute       = document.getElementById("opt-mute");
const optOverlay    = document.getElementById("opt-overlay");
const optAggressive = document.getElementById("opt-aggressive");
const optDelay      = document.getElementById("opt-delay");
const delayValue    = document.getElementById("opt-delay-value");
const delayHint     = document.getElementById("opt-delay-hint");
const statWarnings  = document.getElementById("stat-warnings");
const statStatus    = document.getElementById("stat-status");
const statMode      = document.getElementById("stat-mode");
const warningBox    = document.getElementById("warning-box");
const warningText   = document.getElementById("warning-text");
const versionTag    = document.getElementById("version-tag");
const btnReset      = document.getElementById("btn-reset");
const aggressiveHint = document.getElementById("aggressive-hint");

// ── Load ─────────────────────────────────────────

chrome.storage.local.get(DEFAULT, (s) => {
  optEnabled.checked    = s.enabled;
  optMute.checked       = s.muteAds;
  optOverlay.checked    = s.showOverlay;
  optAggressive.checked = s.aggressiveSkip;
  optDelay.value        = s.skipDelay;

  renderDelay(s.skipDelay);
  renderStatus(s.enabled);
  renderMode(s.aggressiveSkip);
  renderWarnings(s.warningCount || 0);
  renderSlider();
});

// Get version from manifest
fetch(chrome.runtime.getURL("manifest.json"))
  .then(r => r.json())
  .then(m => {
    versionTag.textContent = "v" + m.version;
  });

// ── Events ───────────────────────────────────────

optEnabled.addEventListener("change", () => {
  const on = optEnabled.checked;
  chrome.storage.local.set({ enabled: on });
  renderStatus(on);
});

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

btnReset.addEventListener("click", () => {
  if (confirm("Isso vai resetar todas as configurações e zerar o contador de avisos. Continuar?")) {
    chrome.storage.local.set(DEFAULT, () => {
      location.reload();
    });
  }
});

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

function renderStatus(on) {
  statStatus.textContent = on ? "Ativo" : "Off";
  statStatus.style.color = on ? "hsl(152, 55%, 42%)" : "hsl(0, 72%, 51%)";
}

function renderMode(aggressive) {
  statMode.textContent = aggressive ? "Agressivo" : "Furtivo";
  statMode.style.color = aggressive ? "hsl(355, 65%, 52%)" : "hsl(200, 70%, 55%)";
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

chrome.storage.onChanged.addListener((changes) => {
  if (changes.warningCount) renderWarnings(changes.warningCount.newValue || 0);
  if (changes.enabled) renderStatus(changes.enabled.newValue);
  if (changes.aggressiveSkip) renderMode(changes.aggressiveSkip.newValue);
});
