import { describe, expect, it } from "vitest";
import { channelMatchesEntry, shouldProtectChannel } from "./channelList";

const channel = {
  name: "Canal de Teste",
  link: "https://www.youtube.com/@canaldeteste",
};

describe("channel list helpers", () => {
  it("matches channel names loosely", () => {
    expect(channelMatchesEntry(channel, "canal de teste")).toBe(true);
    expect(channelMatchesEntry(channel, "Teste")).toBe(true);
    expect(channelMatchesEntry(channel, "outro canal")).toBe(false);
  });

  it("matches channel links loosely", () => {
    expect(channelMatchesEntry(channel, "@canaldeteste")).toBe(true);
    expect(channelMatchesEntry(channel, "youtube.com/@canaldeteste")).toBe(true);
  });

  it("protects matched channels in whitelist mode", () => {
    expect(shouldProtectChannel(channel, ["teste"], "whitelist")).toBe(true);
    expect(shouldProtectChannel(channel, ["outro"], "whitelist")).toBe(false);
  });

  it("protects unmatched channels in blacklist mode", () => {
    expect(shouldProtectChannel(channel, ["teste"], "blacklist")).toBe(false);
    expect(shouldProtectChannel(channel, ["outro"], "blacklist")).toBe(true);
  });

  it("keeps the historical empty-list behavior", () => {
    expect(shouldProtectChannel(channel, [], "whitelist")).toBe(false);
    expect(shouldProtectChannel(channel, [], "blacklist")).toBe(true);
  });

  it("does not protect unknown channels when entries exist", () => {
    expect(shouldProtectChannel(null, ["teste"], "whitelist")).toBe(false);
    expect(shouldProtectChannel(null, ["teste"], "blacklist")).toBe(false);
  });
});
