// ══════════════════════════════════════════════════
// YouTube Ad Skipper — Options Page Logic | Taste Skill
// ══════════════════════════════════════════════════

const DEFAULT = {
  totalAdsSkipped: 0,
  adsSkippedToday: 0,
  todayDate: null,
  warningCount: 0,
  whitelist: [],
  showToast: false,
  shortcutEnabled: false,
  instantSkip: false,
};

// ── Elements ─────────────────────────────────────

const statTotal    = document.getElementById("stat-total");
const statToday    = document.getElementById("stat-today");
const statWarnings = document.getElementById("stat-warnings");
const whitelistInput = document.getElementById("whitelist-input");
const whitelistAddBtn = document.getElementById("whitelist-add");
const whitelistList  = document.getElementById("whitelist-list");
const whitelistEmpty = document.getElementById("whitelist-empty");
const toggleToast    = document.getElementById("toggle-toast");
const toggleShortcut = document.getElementById("toggle-shortcut");
const toggleInstant  = document.getElementById("toggle-instant");
const btnReset       = document.getElementById("btn-reset");

let currentWhitelist = [];

// ── Load ─────────────────────────────────────────

chrome.storage.local.get(DEFAULT, (s) => {
  // Stats
  const today = new Date().toISOString().split("T")[0];
  const todayCount = s.todayDate === today ? (s.adsSkippedToday || 0) : 0;

  animateCounter(statTotal, s.totalAdsSkipped || 0);
  animateCounter(statToday, todayCount);
  animateCounter(statWarnings, s.warningCount || 0);

  // Whitelist
  currentWhitelist = Array.isArray(s.whitelist) ? [...s.whitelist] : [];
  renderWhitelist();

  // Toggles
  toggleToast.checked    = !!s.showToast;
  toggleShortcut.checked = !!s.shortcutEnabled;
  toggleInstant.checked  = !!s.instantSkip;
});

// ── Animated counter ─────────────────────────────

function animateCounter(el, target) {
  if (target === 0) { el.textContent = "0"; return; }
  const duration = 600;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString("pt-BR");
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// ── Whitelist ────────────────────────────────────

function renderWhitelist() {
  whitelistList.innerHTML = "";

  if (currentWhitelist.length === 0) {
    whitelistEmpty.style.display = "flex";
    return;
  }

  whitelistEmpty.style.display = "none";

  currentWhitelist.forEach((name, i) => {
    const item = document.createElement("div");
    item.className = "whitelist-item";
    item.innerHTML = `
      <div class="whitelist-item-name">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>${escapeHtml(name)}</span>
      </div>
      <button class="whitelist-remove" data-index="${i}" title="Remover">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    whitelistList.appendChild(item);
  });

  // Attach remove handlers
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

  // Avoid duplicates (case-insensitive)
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

// ── Toggle handlers ──────────────────────────────

toggleToast.addEventListener("change", () => {
  chrome.storage.local.set({ showToast: toggleToast.checked });
});

toggleShortcut.addEventListener("change", () => {
  chrome.storage.local.set({ shortcutEnabled: toggleShortcut.checked });
});

toggleInstant.addEventListener("change", () => {
  chrome.storage.local.set({ instantSkip: toggleInstant.checked });
});

// ── Reset Stats ──────────────────────────────────

btnReset.addEventListener("click", () => {
  chrome.storage.local.set({
    totalAdsSkipped: 0,
    adsSkippedToday: 0,
    todayDate: null,
    warningCount: 0,
  });

  statTotal.textContent = "0";
  statToday.textContent = "0";
  statWarnings.textContent = "0";

  btnReset.textContent = "Resetado ✓";
  btnReset.classList.add("confirmed");
  setTimeout(() => {
    btnReset.textContent = "Resetar";
    btnReset.classList.remove("confirmed");
  }, 2000);
});

// ── Live sync ────────────────────────────────────

chrome.storage.onChanged.addListener((changes) => {
  if (changes.totalAdsSkipped) {
    animateCounter(statTotal, changes.totalAdsSkipped.newValue || 0);
  }
  if (changes.adsSkippedToday) {
    animateCounter(statToday, changes.adsSkippedToday.newValue || 0);
  }
  if (changes.warningCount) {
    animateCounter(statWarnings, changes.warningCount.newValue || 0);
  }
  if (changes.whitelist) {
    currentWhitelist = Array.isArray(changes.whitelist.newValue) ? [...changes.whitelist.newValue] : [];
    renderWhitelist();
  }
});

// ── Utils ────────────────────────────────────────

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
