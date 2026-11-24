import { describe, expect, it } from "vitest";

import { describeUserAgent } from "./user-agent";

const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const FIREFOX_ANDROID =
  "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("describeUserAgent", () => {
  it("Chrome na Linuksie", () => {
    expect(describeUserAgent(CHROME_LINUX)).toEqual({
      label: "Chrome · Linux",
      mobile: false,
    });
  });

  it("Chrome na Windows", () => {
    expect(describeUserAgent(CHROME_WINDOWS)).toEqual({
      label: "Chrome · Windows",
      mobile: false,
    });
  });

  it("Safari na iPhonie jest mobilny", () => {
    expect(describeUserAgent(SAFARI_IPHONE)).toEqual({
      label: "Safari · iPhone",
      mobile: true,
    });
  });

  it("Firefox na Androidzie jest mobilny", () => {
    expect(describeUserAgent(FIREFOX_ANDROID)).toEqual({
      label: "Firefox · Android",
      mobile: true,
    });
  });

  it("Edge wygrywa z Chrome", () => {
    expect(describeUserAgent(EDGE_WINDOWS).label).toBe("Edge · Windows");
  });

  it("Safari na macOS", () => {
    expect(describeUserAgent(SAFARI_MAC)).toEqual({
      label: "Safari · macOS",
      mobile: false,
    });
  });

  it("null → Przeglądarka · nieznany system", () => {
    expect(describeUserAgent(null)).toEqual({
      label: "Przeglądarka · nieznany system",
      mobile: false,
    });
  });
});
