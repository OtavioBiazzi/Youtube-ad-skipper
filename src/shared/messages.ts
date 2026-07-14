export const MAIN_SESSION_MESSAGE = "youtube-extension:main-session";
export const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
export const MAIN_SPEED_THROUGH_MESSAGE = "yt-ad-skipper:speed-through";
export const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";
export const MAIN_QUALITY_MESSAGE = "youtube-extension:set-quality";
export const CODEC_SETTINGS_MESSAGE = "youtube-extension:codec-settings";
export const CODEC_SETTINGS_STORAGE_KEY = "youtubeExtensionCodecSettings";

export type BridgeMessage = {
  source: string;
  token?: string;
  [key: string]: unknown;
};

export function createBridgeSessionToken() {
  try {
    const bytes = new Uint32Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(36)).join("-");
  } catch (err) {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }
}

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return !!data && typeof data === "object" && typeof (data as BridgeMessage).source === "string";
}
