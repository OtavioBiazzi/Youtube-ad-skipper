export const MAIN_SESSION_MESSAGE = "youtube-extension:main-session";
export const MAIN_FORCE_SKIP_MESSAGE = "yt-ad-skipper:force-skip";
export const MAIN_SPEED_THROUGH_MESSAGE = "yt-ad-skipper:speed-through";
export const MAIN_FORCE_SKIP_RESULT = "yt-ad-skipper:force-skip-result";
export const MAIN_PLAYER_RESIZE_MESSAGE = "youtube-extension:player-resize";
export const MAIN_QUALITY_MESSAGE = "youtube-extension:set-quality";
export const MAIN_QUALITY_RESULT = "youtube-extension:quality-result";
export const MAIN_PLAYER_COMMAND = "youtube-extension:player-command";
export const MAIN_LIVE_QUERY = "youtube-extension:live-query";
export const MAIN_LIVE_STATS = "youtube-extension:live-stats";
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
