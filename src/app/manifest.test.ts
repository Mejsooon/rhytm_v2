import { describe, expect, it } from "vitest";

import manifest from "./manifest";

// Manifest PWA musi zgadzać się ze specyfikacją z zadania 13
describe("manifest PWA", () => {
  const dane = manifest();

  it("ma podstawowe pola aplikacji", () => {
    expect(dane.name).toBe("rhytm");
    expect(dane.short_name).toBe("rhytm");
    expect(dane.lang).toBe("pl");
    expect(dane.start_url).toBe("/dzis");
    expect(dane.display).toBe("standalone");
    expect(dane.background_color).toBe("#ffffff");
    expect(dane.theme_color).toBe("#ffffff");
  });

  it("zawiera trzy ikony, a maskable ma purpose 'maskable'", () => {
    expect(dane.icons).toHaveLength(3);
    expect(dane.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ]);
  });
});
