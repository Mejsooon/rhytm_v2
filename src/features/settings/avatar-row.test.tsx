import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveAvatar, removeAvatar, uploadAvatar } = vi.hoisted(() => ({
  saveAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  uploadAvatar: vi.fn(),
}));
vi.mock("./actions", () => ({ saveAvatar, removeAvatar }));
// validateAvatarFile zostaje prawdziwe, podmieniamy tylko wysyłkę do Storage
vi.mock("@/features/onboarding/avatar-upload", async (oryginal) => ({
  ...(await oryginal<typeof import("@/features/onboarding/avatar-upload")>()),
  uploadAvatar,
}));

import { AvatarRow } from "./avatar-row";

function plik(nazwa = "a.png", typ = "image/png", rozmiar = 10) {
  const f = new File(["x"], nazwa, { type: typ });
  Object.defineProperty(f, "size", { value: rozmiar });
  return f;
}

function wejscie() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

describe("AvatarRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadAvatar.mockResolvedValue({ path: "u1/avatar.png" });
    saveAvatar.mockResolvedValue({ ok: true });
    removeAvatar.mockResolvedValue({ ok: true });
    URL.createObjectURL = vi.fn(() => "blob:podglad");
    URL.revokeObjectURL = vi.fn();
  });

  it("bez zdjęcia: inicjał, „Wgraj”, brak „Usuń”", () => {
    render(<AvatarRow userId="u1" avatarUrl={null} displayName="mejson" />);
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(
      screen.getByText("Bez zdjęcia pokażemy inicjały"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wgraj" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usuń" }),
    ).not.toBeInTheDocument();
  });

  it("ze zdjęciem: „Zmień” i „Usuń”, podpis o formatach", () => {
    const { container } = render(
      <AvatarRow
        userId="u1"
        avatarUrl="https://x/y.png"
        displayName="Mejson"
      />,
    );
    expect(screen.getByRole("button", { name: "Zmień" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń" })).toBeInTheDocument();
    expect(screen.getByText("PNG, JPG albo WebP, do 2 MB")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://x/y.png",
    );
  });

  it("za duży plik → komunikat, bez wysyłki", async () => {
    render(<AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />);
    fireEvent.change(wejscie(), {
      target: { files: [plik("a.png", "image/png", 3 * 1024 * 1024)] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Plik jest za duży (maks. 2 MB).",
    );
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(saveAvatar).not.toHaveBeenCalled();
  });

  it("zły typ pliku → komunikat o formacie", async () => {
    render(<AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />);
    fireEvent.change(wejscie(), {
      target: { files: [plik("a.gif", "image/gif")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wybierz zdjęcie PNG, JPG albo WebP.",
    );
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it("udane wgranie → saveAvatar ze ścieżką, „Zapisano ✓”, podgląd lokalny, „Usuń”", async () => {
    const { container } = render(
      <AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />,
    );
    const f = plik();
    fireEvent.change(wejscie(), { target: { files: [f] } });
    expect(await screen.findByText("Zapisano ✓")).toBeInTheDocument();
    expect(uploadAvatar).toHaveBeenCalledWith(f, "u1");
    expect(saveAvatar).toHaveBeenCalledWith("u1/avatar.png");
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "blob:podglad",
    );
    expect(screen.getByRole("button", { name: "Usuń" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zmień" })).toBeInTheDocument();
  });

  it("błąd wgrania → „Nie udało się wgrać zdjęcia.”, bez saveAvatar", async () => {
    uploadAvatar.mockResolvedValue({ error: "Nie udało się wgrać zdjęcia." });
    render(<AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />);
    fireEvent.change(wejscie(), { target: { files: [plik()] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się wgrać zdjęcia.",
    );
    expect(saveAvatar).not.toHaveBeenCalled();
  });

  it("błąd zapisu ścieżki → „Nie udało się wgrać zdjęcia.”", async () => {
    saveAvatar.mockResolvedValue({
      ok: false,
      error: "Nie udało się wgrać zdjęcia.",
    });
    render(<AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />);
    fireEvent.change(wejscie(), { target: { files: [plik()] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się wgrać zdjęcia.",
    );
    expect(screen.getByRole("button", { name: "Wgraj" })).toBeInTheDocument();
  });

  it("Usuń → removeAvatar, powrót do inicjałów", async () => {
    render(
      <AvatarRow
        userId="u1"
        avatarUrl="https://x/y.png"
        displayName="Mejson"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Wgraj" })).toBeInTheDocument(),
    );
    expect(removeAvatar).toHaveBeenCalledTimes(1);
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usuń" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Bez zdjęcia pokażemy inicjały"),
    ).toBeInTheDocument();
  });

  it("błąd usuwania → komunikat, zdjęcie zostaje", async () => {
    removeAvatar.mockResolvedValue({
      ok: false,
      error: "Nie udało się usunąć zdjęcia.",
    });
    render(
      <AvatarRow
        userId="u1"
        avatarUrl="https://x/y.png"
        displayName="Mejson"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się usunąć zdjęcia.",
    );
    expect(screen.getByRole("button", { name: "Zmień" })).toBeInTheDocument();
  });

  it("podwójne kliknięcie „Usuń” → jedno wywołanie", async () => {
    let koniec: (v: { ok: true }) => void = () => {};
    removeAvatar.mockReturnValue(new Promise((r) => (koniec = r)));
    render(
      <AvatarRow
        userId="u1"
        avatarUrl="https://x/y.png"
        displayName="Mejson"
      />,
    );
    const usun = screen.getByRole("button", { name: "Usuń" });
    await userEvent.dblClick(usun);
    expect(removeAvatar).toHaveBeenCalledTimes(1);
    expect(usun).toBeDisabled();
    koniec({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Wgraj" })).toBeInTheDocument(),
    );
  });

  it("odwołuje adres podglądu przy zamianie zdjęcia i przy odmontowaniu", async () => {
    const { unmount } = render(
      <AvatarRow userId="u1" avatarUrl={null} displayName="Mejson" />,
    );
    fireEvent.change(wejscie(), { target: { files: [plik()] } });
    await screen.findByText("Zapisano ✓");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:podglad");
  });
});
