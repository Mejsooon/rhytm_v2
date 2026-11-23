import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingDraft } from "../model";

const uploadAvatar = vi.fn();
vi.mock("../avatar-upload", async () => {
  const actual =
    await vi.importActual<typeof import("../avatar-upload")>(
      "../avatar-upload",
    );
  return { ...actual, uploadAvatar: (...a: unknown[]) => uploadAvatar(...a) };
});

import { StepProfile } from "./step-profile";

const draft: OnboardingDraft = {
  name: "",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: [],
  studyField: "",
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: {
    perm: false,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

const NOW = new Date("2026-11-17T09:00:00Z");
const onChange = vi.fn();
const onAvatarFile = vi.fn();

function pokaz(d: OnboardingDraft = draft, firstVisit = false) {
  return render(
    <StepProfile
      draft={d}
      onChange={onChange}
      userId="u1"
      avatarUrl={null}
      onAvatarFile={onAvatarFile}
      firstVisit={firstVisit}
      now={NOW}
    />,
  );
}

function plik(rozmiar: number, typ: string, nazwa: string) {
  const f = new File(["x"], nazwa, { type: typ });
  Object.defineProperty(f, "size", { value: rozmiar });
  return f;
}

beforeEach(() => {
  onChange.mockReset();
  onAvatarFile.mockReset();
  uploadAvatar.mockReset();
});

describe("StepProfile", () => {
  it("wpisanie nazwy woła onChange z name", async () => {
    pokaz();
    await userEvent.type(screen.getByLabelText("Imię lub pseudonim"), "M");
    expect(onChange).toHaveBeenLastCalledWith({ ...draft, name: "M" });
  });

  it("wybór „Niedzieli” ustawia weekStart: sun", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("radio", { name: "Niedzieli" }));
    expect(onChange).toHaveBeenCalledWith({ ...draft, weekStart: "sun" });
  });

  it("plik 3 MB: komunikat i brak uploadu", async () => {
    pokaz();
    const u = userEvent.setup({ applyAccept: false });
    await u.upload(
      screen.getByLabelText("Wybierz zdjęcie profilowe"),
      plik(3 * 1024 * 1024, "image/png", "a.png"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Plik jest za duży (maks. 2 MB).",
    );
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("plik .gif: komunikat formatu", async () => {
    pokaz();
    const u = userEvent.setup({ applyAccept: false });
    await u.upload(
      screen.getByLabelText("Wybierz zdjęcie profilowe"),
      plik(100, "image/gif", "a.gif"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Wybierz zdjęcie PNG, JPG albo WebP.",
    );
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("udany upload: avatarPath w szkicu i podgląd z pliku", async () => {
    uploadAvatar.mockResolvedValue({ path: "u1/avatar.png" });
    pokaz();
    const f = plik(100, "image/png", "a.png");
    await userEvent.upload(
      screen.getByLabelText("Wybierz zdjęcie profilowe"),
      f,
    );
    expect(uploadAvatar).toHaveBeenCalledWith(f, "u1");
    expect(onChange).toHaveBeenCalledWith({
      ...draft,
      avatarPath: "u1/avatar.png",
    });
    expect(onAvatarFile).toHaveBeenCalledWith(f);
  });

  it("błąd uploadu: komunikat, bez zmiany szkicu", async () => {
    uploadAvatar.mockResolvedValue({ error: "Nie udało się wgrać zdjęcia." });
    pokaz();
    await userEvent.upload(
      screen.getByLabelText("Wybierz zdjęcie profilowe"),
      plik(100, "image/png", "a.png"),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się wgrać zdjęcia.",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("zapisana strefa spoza listy jest w opcjach i wybrana (bez duplikatów z wykrytą)", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "America/Chicago",
    } as Intl.ResolvedDateTimeFormatOptions);
    pokaz({ ...draft, timezone: "America/Chicago" });
    const [webowy] = screen.getAllByRole("button", { name: "Strefa czasowa" });
    expect(webowy).toHaveTextContent("America/Chicago");
    await userEvent.click(webowy);
    expect(
      screen.getAllByRole("option", { name: /America\/Chicago/ }),
    ).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("„Wykryta z przeglądarki” gdy strefa = wykryta", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Europe/Warsaw",
    } as Intl.ResolvedDateTimeFormatOptions);
    pokaz();
    expect(
      screen.getAllByText("Wykryta z przeglądarki").length,
    ).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("pierwsza wizyta: wykryta strefa trafia do szkicu", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Asia/Tokyo",
    } as Intl.ResolvedDateTimeFormatOptions);
    pokaz(draft, true);
    expect(onChange).toHaveBeenCalledWith({ ...draft, timezone: "Asia/Tokyo" });
    vi.restoreAllMocks();
  });

  it("kolejna wizyta: strefa zostaje", () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Asia/Tokyo",
    } as Intl.ResolvedDateTimeFormatOptions);
    pokaz(draft, false);
    expect(onChange).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // Wygląd wg COnboarding
  it("wygląd: wiersz zdjęcia z ikoną w przycisku, strefa jako Dropdown select z hintem UTC", () => {
    pokaz();
    const wgraj = screen.getByRole("button", { name: "Wgraj" });
    expect(wgraj.querySelector("svg")).not.toBeNull();
    const [webowy] = screen.getAllByRole("button", { name: "Strefa czasowa" });
    expect(webowy).toHaveTextContent("Europe/Warsaw (UTC+01:00)");
    expect(webowy.querySelector("svg.lucide-chevrons-up-down")).not.toBeNull();
    expect(screen.getByText("(UTC+01:00)")).toHaveClass("tabular-nums");
  });

  it("wygląd: segmenty tygodnia i godziny wypełniają szerokość kolumny", () => {
    pokaz();
    for (const nazwa of ["Początek tygodnia", "Format godziny"]) {
      const grupa = screen.getByRole("radiogroup", { name: nazwa });
      expect(grupa).toHaveClass("w-full");
      expect(grupa).toHaveClass("flex");
    }
  });

  it("bez font-mono", () => {
    const { container } = pokaz();
    expect(container.innerHTML).not.toContain("font-mono");
  });
});
