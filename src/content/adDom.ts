import { isLikelySkipControlText } from "../shared/adStrategy";

const SKIP_BUTTON_CLASSES = [
  "videoAdUiSkipButton",
  "ytp-ad-skip-button ytp-button",
  "ytp-ad-skip-button-modern ytp-button",
  "ytp-skip-ad-button",
];

const SKIP_BUTTON_SELECTORS = [
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-slot button",
  ".ytp-ad-skip-button-container button",
  'button[id^="skip-button"]',
  "div.ytp-ad-skip-button-slot button",
  '[aria-label*="Skip" i]',
  '[aria-label*="Pular" i]',
  '[title*="Skip" i]',
  '[title*="Pular" i]',
  '[class*="skip"][class*="ad" i]',
  ".ytp-ad-overlay-close-button",
];

export function getYouTubePlayer(doc: Document = document): HTMLElement | null {
  return (doc.getElementById("movie_player") || doc.querySelector(".html5-video-player")) as HTMLElement | null;
}

function getClickableTarget(element: Element | null): HTMLElement | null {
  if (!element) return null;
  return (element.closest(
    'button, [role="button"], .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .videoAdUiSkipButton',
  ) || element) as HTMLElement;
}

function isClickableVisible(element: HTMLElement | null): element is HTMLElement {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.pointerEvents !== "none";
}

export function clickElement(element: Element | null): boolean {
  const target = getClickableTarget(element);
  if (!isClickableVisible(target) || typeof target.click !== "function") return false;
  target.click();
  return true;
}

export function getAdPlaying(doc: Document = document): boolean {
  const player = getYouTubePlayer(doc);
  if (player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting")) {
    return true;
  }

  const root: ParentNode = player || doc;
  const badges = root.querySelectorAll<HTMLElement>(
    ".ytp-ad-badge, .ytp-ad-visit-advertiser-button, .ytp-visit-advertiser-link",
  );
  return Array.from(badges).some((badge) => badge.offsetWidth > 0 || badge.offsetHeight > 0);
}

export function findSkipAdButton(doc: Document = document): HTMLElement | null {
  const root = getYouTubePlayer(doc) || doc.documentElement;

  for (const className of SKIP_BUTTON_CLASSES) {
    for (const element of root.getElementsByClassName(className)) {
      const target = getClickableTarget(element);
      if (isClickableVisible(target)) return target;
    }
  }

  for (const selector of SKIP_BUTTON_SELECTORS) {
    for (const element of root.querySelectorAll(selector)) {
      const target = getClickableTarget(element);
      if (isClickableVisible(target)) return target;
    }
  }

  for (const element of root.querySelectorAll("button, [role='button'], a")) {
    const label = [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title")]
      .filter(Boolean)
      .join(" ");
    const target = getClickableTarget(element);
    if (isLikelySkipControlText(label) && isClickableVisible(target)) return target;
  }

  return null;
}

export function clickSkipAdBtn(candidate: HTMLElement | null = findSkipAdButton()): boolean {
  return clickElement(candidate);
}
