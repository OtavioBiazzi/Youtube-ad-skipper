(function() {
  "use strict";
  const DEFAULT_SETTINGS = {
    enabled: true,
    adSkipperEnabled: true,
    aggressiveSkip: true
  };
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
  const ICON_DEFAULTS = {
    enabled: DEFAULT_SETTINGS.enabled,
    adSkipperEnabled: DEFAULT_SETTINGS.adSkipperEnabled,
    aggressiveSkip: DEFAULT_SETTINGS.aggressiveSkip
  };
  chrome.storage.local.get(ICON_DEFAULTS, (s) => {
    updateIcon(s);
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled || changes.adSkipperEnabled || changes.aggressiveSkip) {
      chrome.storage.local.get(ICON_DEFAULTS, (s) => {
        updateIcon(s);
      });
    }
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "youtube-extension:open-options") {
      chrome.runtime.openOptionsPage(() => {
        if (!chrome.runtime.lastError) {
          sendResponse({ ok: true });
          return;
        }
        try {
          chrome.tabs?.create?.({ url: chrome.runtime.getURL("options.html") }, () => {
            sendResponse({ ok: !chrome.runtime.lastError });
          });
        } catch (err) {
          sendResponse({ ok: false });
        }
      });
      return true;
    }
  });
})();
