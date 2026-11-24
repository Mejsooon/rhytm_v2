import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExportCard } from "./export-card";

function odpowiedz(rozmiar: number, nazwa = "rhytm-export-2026-11-24.json") {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nazwa}"`,
    }),
    blob: async () => new Blob(["x".repeat(rozmiar)]),
  };
}

describe("ExportCard", () => {
  const createObjectURL = vi.fn(() => "blob:eksport");
  const revokeObjectURL = vi.fn();
  let klik: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    klik = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    klik.mockRestore();
    vi.clearAllMocks();
  });

  it("bez wcześniejszego eksportu: „ostatni eksport: nigdy” i „Pobierz .json”", () => {
    render(<ExportCard />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "ostatni eksport: nigdy",
    );
    expect(
      screen.getByRole("button", { name: "Pobierz .json" }),
    ).toBeInTheDocument();
  });

  it("zapisany eksport → data DD.MM.RRRR", async () => {
    localStorage.setItem(
      "rhytm-ostatni-eksport",
      JSON.stringify({
        name: "a.json",
        size: "1 KB",
        at: "2026-11-16T10:00:00Z",
      }),
    );
    render(<ExportCard />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "ostatni eksport: 16.11.2026",
      ),
    );
  });

  it("w trakcie „przygotowuję plik…”, po sukcesie nazwa, rozmiar z przecinkiem i „Pobierz ponownie”", async () => {
    let oddaj: (v: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((r) => {
        oddaj = r;
      }),
    );
    render(<ExportCard />);
    fireEvent.click(screen.getByRole("button", { name: "Pobierz .json" }));
    expect(screen.getByRole("status")).toHaveTextContent("przygotowuję plik…");
    expect(
      screen.getByRole("button", { name: "Pobierz .json" }),
    ).toHaveAttribute("aria-disabled", "true");

    oddaj(odpowiedz(Math.round(2.4 * 1024 * 1024)) as unknown as Response);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "rhytm-export-2026-11-24.json · 2,4 MB · pobrano",
      ),
    );
    expect(fetch).toHaveBeenCalledWith("/api/eksport", { cache: "no-store" });
    expect(createObjectURL).toHaveBeenCalled();
    expect(klik).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Pobierz ponownie" }),
    ).toBeInTheDocument();

    const zapis = JSON.parse(
      localStorage.getItem("rhytm-ostatni-eksport") ?? "{}",
    );
    expect(zapis).toMatchObject({
      name: "rhytm-export-2026-11-24.json",
      size: "2,4 MB",
    });
    expect(typeof zapis.at).toBe("string");
  });

  it("mały plik w KB", async () => {
    vi.mocked(fetch).mockResolvedValue(
      odpowiedz(340 * 1024) as unknown as Response,
    );
    render(<ExportCard />);
    fireEvent.click(screen.getByRole("button", { name: "Pobierz .json" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "rhytm-export-2026-11-24.json · 340 KB · pobrano",
      ),
    );
  });

  it("błąd → komunikat", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);
    render(<ExportCard />);
    fireEvent.click(screen.getByRole("button", { name: "Pobierz .json" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Nie udało się przygotować eksportu. Spróbuj ponownie.",
      ),
    );
    expect(localStorage.getItem("rhytm-ostatni-eksport")).toBeNull();
  });
});
