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
  // Survey ads ("Pular pesquisa") use their own containers.
  ".ytp-ad-survey .ytp-ad-skip-button-modern",
  ".ytp-ad-survey [class*=\"skip\"] button",
  ".ytp-ad-survey-interstitial [class*=\"skip\"] button",
];

// Survey ads sometimes play without the player's ad-showing class.
const AD_SURVEY_SELECTORS = ".ytp-ad-survey, .ytp-ad-survey-interstitial, .ytp-ad-survey-question";

export function getYouTubePlayer(doc: Document = document): HTMLElement | null {
  return (doc.getElementById("movie_player") || doc.querySelector(".html5-video-player")) as HTMLElement | null;
}

/**
 * The main YouTube <video>. Never use document.querySelector("video"): hover
 * previews (ytd-video-preview / #inline-player) also own <video> elements and
 * often appear earlier in the DOM than the watch player.
 */
export function getMainVideo(doc: Document = document): HTMLVideoElement | null {
  const player = getYouTubePlayer(doc);
  if (!player) return null;
  return (player.querySelector("video.html5-main-video") || player.querySelector("video")) as HTMLVideoElement | null;
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
  const survey = root.querySelector<HTMLElement>(AD_SURVEY_SELECTORS);
  if (survey && (survey.offsetWidth > 0 || survey.offsetHeight > 0)) return true;
  const badges = root.querySelectorAll<HTMLElement>(
    ".ytp-ad-badge, .ytp-ad-visit-advertiser-button, .ytp-visit-advertiser-link",
  );
  return Array.from(badges).some((badge) => badge.offsetWidth > 0 || badge.offsetHeight > 0);
}

let surveySkipEnabled = true;

/** Survey ads ("Pular pesquisa") are only skipped when this option is on. */
export function setSurveySkipEnabled(enabled: boolean) {
  surveySkipEnabled = enabled;
}

function isSurveyElement(element: Element) {
  return !!element.closest(AD_SURVEY_SELECTORS);
}

export function findSkipAdButton(doc: Document = document): HTMLElement | null {
  const root = getYouTubePlayer(doc) || doc.documentElement;

  for (const className of SKIP_BUTTON_CLASSES) {
    for (const element of root.getElementsByClassName(className)) {
      if (!surveySkipEnabled && isSurveyElement(element)) continue;
      const target = getClickableTarget(element);
      if (isClickableVisible(target)) return target;
    }
  }

  for (const selector of SKIP_BUTTON_SELECTORS) {
    for (const element of root.querySelectorAll(selector)) {
      if (!surveySkipEnabled && isSurveyElement(element)) continue;
      const target = getClickableTarget(element);
      if (isClickableVisible(target)) return target;
    }
  }

  for (const element of root.querySelectorAll("button, [role='button'], a")) {
    const label = [element.textContent, element.getAttribute("aria-label"), element.getAttribute("title")]
      .filter(Boolean)
      .join(" ");
    if (!surveySkipEnabled && isSurveyElement(element)) continue;
    const target = getClickableTarget(element);
    if (isLikelySkipControlText(label) && isClickableVisible(target)) return target;
  }

  return null;
}

export function clickSkipAdBtn(candidate: HTMLElement | null = findSkipAdButton()): boolean {
  return clickElement(candidate);
}
