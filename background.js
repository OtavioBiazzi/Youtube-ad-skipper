const ICONS = {
  active: {
    "48": "icon48.png",
    "128": "icon128.png"
  },
  passive: {
    "48": "icon48_passive.png",
    "128": "icon128_passive.png"
  },
  disabled: {
    "48": "icon48_disabled.png",
    "128": "icon128_disabled.png"
  }
};

function updateIcon(settings) {
  let state = "active";
  
  if (settings.enabled === false) {
    state = "disabled";
  } else if (settings.aggressiveSkip === false) {
    state = "passive";
  }
  
  chrome.action.setIcon({ path: ICONS[state] });
}

// Initial set
chrome.storage.local.get({ enabled: true, aggressiveSkip: true }, (s) => {
  updateIcon(s);
});

// Watch for changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled || changes.aggressiveSkip) {
    chrome.storage.local.get({ enabled: true, aggressiveSkip: true }, (s) => {
      updateIcon(s);
    });
  }
});
