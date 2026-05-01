(function() {
  "use strict";
  const DEFAULT_SETTINGS = {
    enabled: true,
    adSkipperEnabled: true,
    skipDelay: 1,
    muteAds: true,
    showOverlay: true,
    aggressiveSkip: true,
    warningCount: 0,
    theme: "dark"
  };
  function byId(id) {
    return document.getElementById(id);
  }
  function query(selector) {
    return document.querySelector(selector);
  }
  const toggleEnabled = byId("toggle-enabled");
  const toggleAdSkipper = byId("toggle-ad-skipper");
  const toggleMute = byId("toggle-mute");
  const toggleOverlay = byId("toggle-overlay");
  const toggleAggressive = byId("toggle-aggressive");
  const skipDelaySlider = byId("skip-delay");
  const delayDisplay = byId("delay-display");
  const delayHint = byId("delay-hint");
  const blockDelay = byId("block-delay");
  const statusPip = query(".status-pip");
  const statusLabel = byId("status-text");
  const container = query(".popup-container");
  const warningRow = byId("warning-row");
  const warningText = byId("warning-text");
  const versionTag = byId("version-tag");
  const stateIcons = Array.from(document.querySelectorAll("[data-state-icon]"));
  const notes = {
    enabled: document.getElementById("note-enabled"),
    adSkipperEnabled: document.getElementById("note-ad-skipper"),
    skipDelay: document.getElementById("note-delay"),
    muteAds: document.getElementById("note-mute"),
    showOverlay: document.getElementById("note-overlay"),
    aggressiveSkip: document.getElementById("note-aggressive")
  };
  let initialState = {};
  try {
    const manifestVersion = chrome.runtime.getManifest().version;
    if (versionTag) versionTag.textContent = `v${manifestVersion}`;
  } catch (err) {
    console.warn("[YouTube Extension] Failed to read manifest version:", err);
    if (versionTag) versionTag.textContent = "v-";
  }
  chrome.storage.local.get(DEFAULT_SETTINGS, (s) => {
    toggleEnabled.checked = s.enabled;
    toggleAdSkipper.checked = s.adSkipperEnabled !== false;
    toggleMute.checked = s.muteAds;
    toggleOverlay.checked = s.showOverlay;
    toggleAggressive.checked = s.aggressiveSkip;
    skipDelaySlider.value = String(s.skipDelay);
    initialState = {
      enabled: s.enabled,
      adSkipperEnabled: s.adSkipperEnabled !== false,
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
    const nextSettings = { aggressiveSkip: on };
    if (!on) nextSettings.instantSkip = false;
    chrome.storage.local.set(nextSettings);
    renderAggressiveState(on);
    checkChanges();
  });
  toggleAdSkipper.addEventListener("change", () => {
    chrome.storage.local.set({ adSkipperEnabled: toggleAdSkipper.checked });
    checkChanges();
  });
  skipDelaySlider.addEventListener("input", () => {
    const v = parseInt(skipDelaySlider.value, 10);
    renderDelay(v);
    renderSliderTrack();
    chrome.storage.local.set({ skipDelay: v });
    checkChanges();
  });
  function applyTheme(theme) {
    if (theme === "light") {
      document.body.classList.add("theme-light");
    } else {
      document.body.classList.remove("theme-light");
    }
  }
  function checkChanges() {
    if (!initialState || Object.keys(initialState).length === 0) return;
    const current = {
      enabled: toggleEnabled.checked,
      adSkipperEnabled: toggleAdSkipper.checked,
      skipDelay: parseInt(skipDelaySlider.value, 10),
      muteAds: toggleMute.checked,
      showOverlay: toggleOverlay.checked,
      aggressiveSkip: toggleAggressive.checked
    };
    for (const key of Object.keys(current)) {
      if (notes[key]) {
        notes[key].style.display = current[key] !== initialState[key] ? "block" : "none";
      }
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
    const pct = (val - min) / (max - min) * 100;
    skipDelaySlider.style.background = "linear-gradient(90deg, var(--accent) " + pct + "%, var(--border) " + pct + "%)";
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
    renderStateIcons(enabled, toggleAggressive.checked);
  }
  function renderAggressiveState(on) {
    if (on) {
      blockDelay.classList.remove("block--disabled");
    } else {
      blockDelay.classList.add("block--disabled");
    }
    renderStateIcons(toggleEnabled.checked, on);
  }
  function getStateIconPath(enabled, aggressive) {
    if (!enabled) return "icon48_off.png";
    return aggressive ? "icon48.png" : "icon48_stealth.png";
  }
  function renderStateIcons(enabled, aggressive) {
    const path = getStateIconPath(enabled, aggressive);
    stateIcons.forEach((icon) => {
      icon.src = path;
    });
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
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
      toggleEnabled.checked = !!changes.enabled.newValue;
      renderStatus(!!changes.enabled.newValue);
    }
    if (changes.muteAds) toggleMute.checked = !!changes.muteAds.newValue;
    if (changes.adSkipperEnabled) toggleAdSkipper.checked = changes.adSkipperEnabled.newValue !== false;
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
  byId("btn-open-settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  byId("btn-open-settings-main").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
})();
