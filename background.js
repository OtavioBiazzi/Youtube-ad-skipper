(function() {
  "use strict";
  const ICONS = {
    active: {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    },
    passive: {
      "16": "icon16_stealth.png",
      "48": "icon48_stealth.png",
      "128": "icon128_stealth.png"
    },
    disabled: {
      "16": "icon16_off.png",
      "48": "icon48_off.png",
      "128": "icon128_off.png"
    }
  };
  function updateIcon(settings) {
    let state = "active";
    if (settings.enabled === false) {
      state = "disabled";
    } else if (settings.adSkipperEnabled === false || settings.aggressiveSkip === false) {
      state = "passive";
    }
    chrome.action.setIcon({ path: ICONS[state] });
  }
  chrome.storage.local.get({ enabled: true, adSkipperEnabled: true, aggressiveSkip: true }, (s) => {
    updateIcon(s);
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled || changes.adSkipperEnabled || changes.aggressiveSkip) {
      chrome.storage.local.get({ enabled: true, adSkipperEnabled: true, aggressiveSkip: true }, (s) => {
        updateIcon(s);
      });
    }
  });
})();
