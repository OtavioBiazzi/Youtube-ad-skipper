import type { ListMode } from "./settings";

export type ChannelInfo = {
  name: string;
  link?: string;
};

export function channelMatchesEntry(channel: ChannelInfo, entry: unknown) {
  const needle = String(entry || "").toLowerCase().trim();
  if (!needle) return false;

  const name = String(channel.name || "").toLowerCase().trim();
  const link = String(channel.link || "").toLowerCase().trim();

  if (name && (name.includes(needle) || needle.includes(name))) return true;
  if (link && needle.length > 3 && (link.includes(needle) || needle.includes(link))) return true;

  return false;
}

export function shouldProtectChannel(channel: ChannelInfo | null, entries: unknown[] = [], mode: ListMode = "whitelist") {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return mode === "blacklist";
  if (!channel) return false;

  const matched = list.some(entry => channelMatchesEntry(channel, entry));

  if (mode === "blacklist") {
    return !matched;
  }

  return matched;
}
