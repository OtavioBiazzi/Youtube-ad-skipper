// Player-side stylesheets, kept out of content.ts. Pure functions: they only
// read the shared ids below and the values passed in.

export const PLAYER_CONTROLS_ID = "yte-controls";
export const FILTER_PANEL_ID = "yte-filter-panel";
export const END_TIME_ID = "yte-end-time";
export const PLAYER_TOOLBAR_ID = "tube-shield-player-toolbar";
export const MINIPLAYER_ACTIVE_CLASS = "tube-shield-miniplayer-active";
export const MINIPLAYER_CLOSE_ID = "yte-miniplayer-close";
export const MINIPLAYER_SLOT_ATTR = "data-yte-mini-slot";

export function buildPlayerUiCss() {
  return `
    #${PLAYER_CONTROLS_ID} {
      display: inline-flex;
      align-items: center;
      height: 100%;
      vertical-align: top;
      float: left;
    }

    #${PLAYER_CONTROLS_ID} .yte-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 100%;
      min-height: 36px;
      padding: 0;
      color: #fff;
      opacity: 1;
      font: 600 16px/1 "YouTube Sans", Roboto, Arial, sans-serif;
      letter-spacing: 0.01em;
      transition: opacity 0.12s ease;
    }

    #${PLAYER_CONTROLS_ID} .yte-btn:hover,
    #${PLAYER_CONTROLS_ID} .yte-btn:focus-visible {
      opacity: 1;
    }

    /* Same hover as YouTube's own buttons: a soft white pill (10%). */
    #${PLAYER_CONTROLS_ID} .yte-btn {
      border-radius: 40px;
      transition: background-color 0.1s cubic-bezier(0.4, 0, 1, 1);
    }

    #${PLAYER_CONTROLS_ID} .yte-btn:hover,
    #${PLAYER_CONTROLS_ID} .yte-btn:focus-visible {
      background-color: rgba(255, 255, 255, 0.1);
      transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }

    #${PLAYER_CONTROLS_ID} .yte-btn svg {
      width: 24px;
      height: 24px;
      fill: currentColor;
      stroke: none;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
    }

    #${PLAYER_CONTROLS_ID} .yte-btn.is-active::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 7px;
      width: 20px;
      height: 3px;
      margin-left: -10px;
      border-radius: 2px;
      background: #f03;
    }

    #${PLAYER_CONTROLS_ID} .yte-btn--text {
      width: auto;
      min-width: 48px;
      font-size: 17px;
      font-weight: 400;
      padding: 0 6px;
      font-variant-numeric: tabular-nums;
    }

    #${PLAYER_CONTROLS_ID} .yte-live {
      gap: 6px;
      padding: 0 10px 0 8px;
      font-size: 14px;
    }

    #${PLAYER_CONTROLS_ID} .yte-live::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #8a8a8a;
    }

    #${PLAYER_CONTROLS_ID} .yte-live.is-synced::before { background: #f03; }
    #${PLAYER_CONTROLS_ID} .yte-live.is-catching::before { background: #ffb020; }

    #${PLAYER_CONTROLS_ID} .yte-btn[data-tip]:hover::before {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 12px);
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 9px;
      border-radius: 4px;
      background: rgba(28, 28, 28, 0.92);
      color: #eee;
      font: 500 12px/1.2 Roboto, Arial, sans-serif;
      white-space: nowrap;
      pointer-events: none;
      z-index: 80;
    }

    #${PLAYER_CONTROLS_ID} [data-fit-hidden] {
      display: none;
    }

    /* Premium-only speed chips work through the extension: drop the upsell marks. */
    #movie_player .ytp-variable-speed-panel-premium-upsell-icon,
    #movie_player .ytp-variable-speed-panel-premium-badge { display: none !important; }


    #${END_TIME_ID}:empty { display: none; }
    #movie_player.yte-no-endtime #${END_TIME_ID} { display: none; }

    #${END_TIME_ID} {
      margin-left: 6px;
      color: rgba(255, 255, 255, 0.72);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* The panel uses YouTube's .ytp-popup/.ytp-menuitem styles; these are
       only placement and fallbacks (zero specificity via :where). */
    #${FILTER_PANEL_ID} {
      position: absolute;
      right: 12px;
      bottom: 62px;
      z-index: 70;
      border-radius: 12px !important;
      overflow: hidden !important;
    }

    #${FILTER_PANEL_ID}[hidden], #yte-live-panel[hidden] { display: none !important; }

    @keyframes yte-popup-in {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }

    #${FILTER_PANEL_ID}:not([hidden]),
    #yte-live-panel:not([hidden]) {
      animation: yte-popup-in 0.16s cubic-bezier(0.05, 0, 0, 1);
      transform-origin: bottom right;
    }

    #yte-live-panel {
      position: absolute;
      left: 12px;
      bottom: 62px;
      z-index: 70;
      border-radius: 12px !important;
      overflow: hidden !important;
      transition: opacity 0.1s cubic-bezier(0.4, 0, 1, 1);
    }

    #movie_player.ytp-autohide #yte-live-panel { opacity: 0; pointer-events: none; }
    #yte-live-panel .yte-menuitem--info { cursor: default; opacity: 0.75; }
    #yte-live-panel .yte-menuitem--info:hover { background: transparent; }

    #yte-live-latency {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: auto;
      height: auto;
      margin-left: 6px;
      padding: 2px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font: 500 13px/1.4 Roboto, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      vertical-align: middle;
      cursor: pointer;
    }

    #yte-live-latency::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.55);
    }

    #yte-live-latency[data-state="on"]::before { background: #2ba640; }
    #yte-live-latency[data-state="catching"]::before { background: #ffb020; }
    #yte-live-latency:hover { background: rgba(255, 255, 255, 0.22); }

    /* Fade out together with YouTube's controls when the mouse stops. */
    #${FILTER_PANEL_ID} { transition: opacity 0.1s cubic-bezier(0.4, 0, 1, 1); }
    #movie_player.ytp-autohide #${FILTER_PANEL_ID} {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s cubic-bezier(0, 0, 0.2, 1);
    }

    /* While the panel is open, YouTube's fullscreen quick actions
       (like/dislike/comment/share) step aside instead of overlapping it. */
    #movie_player.yte-filter-panel-open .ytp-fullscreen-quick-actions,
    #movie_player.yte-filter-panel-open .ytp-overlay-bottom-right {
      visibility: hidden !important;
    }

    :where(#${FILTER_PANEL_ID}) {
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.6);
      overflow: hidden;
      color: #eee;
    }

    #${FILTER_PANEL_ID} .ytp-panel { overflow-y: auto; overflow-x: hidden; }

    .yte-gear-subpanel .ytp-menuitem-label { white-space: nowrap; }
    .yte-gear-subpanel { overflow-x: hidden; }

    .yte-filter-scope .yte-menuitem--slider { cursor: default; }

    .yte-filter-scope .yte-menu-slider {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: 150px;
    }

    .yte-filter-scope .yte-menu-slider output {
      min-width: 38px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .yte-filter-scope .yte-menu-slider input[type="range"] {
      flex: 1;
      min-width: 0;
      height: 16px;
      margin: 0;
      background: transparent;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }

    .yte-filter-scope .yte-menu-slider input[type="range"]::-webkit-slider-runnable-track {
      height: 3px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.3);
    }

    .yte-filter-scope .yte-menu-slider input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -4.5px;
      border-radius: 50%;
      background: #fff;
    }

    .yte-filter-scope .yte-menu-slider input[type="range"]:focus-visible { outline: none; }
    .yte-filter-scope .yte-menu-slider input[type="range"]:focus-visible::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
    }

    /* Style "pill": our own rounded group next to YouTube's, using the
       same background/radius/height read from YouTube's group at runtime. */
    #${PLAYER_CONTROLS_ID}.yte-style-pill {
      float: none;
      align-self: center;
      flex: none;
      height: var(--yte-pill-h, 40px);
      margin: 0 var(--yte-pill-gap, 12px);
      padding: 0 4px;
      border-radius: var(--yte-pill-radius, 28px);
      background: var(--yte-pill-bg, rgba(0, 0, 0, 0.3));
    }

    #${PLAYER_CONTROLS_ID}.yte-style-pill .yte-btn { min-height: 0; }

    /* Style "divider": inside YouTube's group, separated by a thin line. */
    #${PLAYER_CONTROLS_ID}.yte-style-divider::after {
      content: "";
      align-self: center;
      width: 1px;
      height: 20px;
      margin: 0 6px 0 4px;
      background: rgba(255, 255, 255, 0.28);
    }
  `;
}

export function buildPlayerToolbarCss() {
  return `
    #${PLAYER_TOOLBAR_ID} {
      --yse-toolbar-bg: rgba(18, 18, 20, 0.9);
      --yse-toolbar-border: rgba(255, 255, 255, 0.14);
      --yse-toolbar-color: rgba(255, 255, 255, 0.84);
      --yse-toolbar-hover: rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      gap: 6px;
      width: max-content;
      max-width: calc(100% - 16px);
      margin: 8px 0 12px;
      padding: 6px;
      border: 1px solid var(--yse-toolbar-border);
      border-radius: 999px;
      background: var(--yse-toolbar-bg);
      color: var(--yse-toolbar-color);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-sizing: border-box;
    }

    html:not([dark]) #${PLAYER_TOOLBAR_ID} {
      --yse-toolbar-bg: rgba(255, 255, 255, 0.92);
      --yse-toolbar-border: rgba(15, 15, 15, 0.13);
      --yse-toolbar-color: rgba(15, 15, 15, 0.82);
      --yse-toolbar-hover: rgba(15, 15, 15, 0.08);
      box-shadow: 0 10px 24px rgba(15, 15, 15, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.82);
    }

    #${PLAYER_TOOLBAR_ID}.is-centered {
      margin-left: auto;
      margin-right: auto;
    }

    #${PLAYER_TOOLBAR_ID}.is-inside {
      position: absolute;
      left: 50%;
      bottom: 54px;
      transform: translateX(-50%);
      z-index: 60;
      margin: 0;
    }

    #player-container-outer:has(#${PLAYER_TOOLBAR_ID}.is-inside),
    #player-theater-container:has(#${PLAYER_TOOLBAR_ID}.is-inside),
    #player:has(#${PLAYER_TOOLBAR_ID}.is-inside),
    ytd-player:has(#${PLAYER_TOOLBAR_ID}.is-inside) {
      position: relative !important;
    }

    #${PLAYER_TOOLBAR_ID}.is-always-visible {
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn {
      width: 34px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--yse-toolbar-color);
      cursor: pointer;
      transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
    }

    #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:hover,
    #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:focus-visible {
      color: #fff;
      background: var(--yse-toolbar-hover);
      border-color: var(--yse-toolbar-border);
      outline: none;
    }

    #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn:active {
      transform: translateY(1px) scale(0.98);
    }

    #${PLAYER_TOOLBAR_ID} .tube-shield-toolbar-btn.is-active {
      color: #fff;
      background: rgba(255, 51, 75, 0.84);
      border-color: rgba(255, 255, 255, 0.18);
    }

    #${PLAYER_TOOLBAR_ID} svg {
      width: 18px;
      height: 18px;
      color: currentColor !important;
      stroke: currentColor !important;
      fill: none !important;
      pointer-events: none;
    }

    #${PLAYER_TOOLBAR_ID} svg [fill="currentColor"] {
      fill: currentColor !important;
      stroke: none !important;
    }

    #${PLAYER_TOOLBAR_ID} svg * {
      vector-effect: non-scaling-stroke;
    }

    /* visibility (not display) so hiding it does not shift the page */
    html.${MINIPLAYER_ACTIVE_CLASS} #${PLAYER_TOOLBAR_ID} {
      visibility: hidden !important;
      pointer-events: none !important;
    }

    @media (max-width: 720px) {
      #${PLAYER_TOOLBAR_ID} {
        overflow-x: auto;
        border-radius: 16px;
        width: 100%;
        max-width: 100%;
        justify-content: flex-start;
      }
    }
  `;
}

export function buildMiniplayerCss(size: { width: number; height: number }, positionCss: string) {
  // z-index stays below YouTube's masthead (2020) and its dropdowns/dialogs
  // (2200+), so menus like "Sort comments" open on top of the miniplayer.
  return `
    [${MINIPLAYER_SLOT_ATTR}] {
      min-height: var(--yte-mini-slot-height, 0px) !important;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container-outer,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container-inner,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-container,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-theater-container,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #player-full-bleed-container,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy #full-bleed-container,
    html.${MINIPLAYER_ACTIVE_CLASS} ytd-watch-flexy ytd-player {
      z-index: 2010 !important;
      overflow: visible !important;
      transform: none !important;
      contain: none !important;
      filter: none !important;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player.html5-video-player {
      position: fixed !important;
      ${positionCss}
      width: min(${size.width}px, calc(100vw - 36px)) !important;
      height: min(${size.height}px, calc(100vh - 90px)) !important;
      z-index: 2010 !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.14) !important;
      background: #000 !important;
      animation: yte-mini-in 180ms ease-out;
    }

    @keyframes yte-mini-in {
      from { opacity: 0; transform: translateY(-8px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .html5-video-container,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .html5-main-video,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player video {
      width: 100% !important;
      height: 100% !important;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player video.html5-main-video {
      left: 0 !important;
      top: 0 !important;
      object-fit: contain !important;
      transform: none !important;
    }

    /* YouTube sizes the control bar in px for the docked player. */
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-chrome-bottom {
      width: calc(100% - 24px) !important;
      left: 12px !important;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-ce-element,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-cards-teaser,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-size-button,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-miniplayer-button,
    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player .ytp-chapter-container {
      display: none !important;
    }

    #${MINIPLAYER_CLOSE_ID} {
      display: none;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #${MINIPLAYER_CLOSE_ID} {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 80;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition: opacity 140ms ease, background 140ms ease;
    }

    html.${MINIPLAYER_ACTIVE_CLASS} #movie_player:hover #${MINIPLAYER_CLOSE_ID},
    html.${MINIPLAYER_ACTIVE_CLASS} #${MINIPLAYER_CLOSE_ID}:focus-visible {
      opacity: 1;
    }

    #${MINIPLAYER_CLOSE_ID}:hover {
      background: rgba(255, 51, 75, 0.9);
    }

    #${MINIPLAYER_CLOSE_ID} svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2.4;
      fill: none;
    }
  `;
}
