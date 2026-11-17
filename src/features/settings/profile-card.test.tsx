import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveProfile } = vi.hoisted(() => ({ saveProfile: vi.fn() }));
vi.mock("./actions", () => ({ saveProfile }));

import { ProfileCard } from "./profile-card";

const strefy = [
  { value: "Europe/Warsaw", city: "Warszawa", offset: "UTC+01:00" },
  { value: "Europe/Berlin", city: "Berlin", offset: "UTC+01:00" },
];
const zapisane = { name: "Mejson", tz: "Europe/Warsaw", kg: "", cm: "" };

function zapisz() {
  return screen.getByRole("button", { name: "Zapisz" });
}

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveProfile.mockResolvedValue({ ok: true });
  });

  it("pokazuje opis, pola i stopkę bez zmian; Zapisz nieaktywne, Cofnij ukryte", () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    expect(screen.getByText("Waga i wzrost służą do liczenia kcal biegów.")).toBeInTheDocument();
    expect(screen.getByLabelText("Wyświetlana nazwa")).toHaveValue("Mejson");
    expect(screen.getByLabelText("Waga (kg)")).toHaveAttribute("placeholder", "np. 75");
    expect(screen.getByText("Waga i wzrost są opcjonalne.")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cofnij" })).not.toBeInTheDocument();
  });

  it("pusta nazwa → błąd pod polem i Zapisz nieaktywne", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.clear(screen.getByLabelText("Wyświetlana nazwa"));
    expect(screen.getByText("Nazwa nie może być pusta.")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("zła waga → błąd na żywo", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.type(screen.getByLabelText("Waga (kg)"), "20");
    expect(screen.getByText("Podaj liczbę 30–250.")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("waga „72,5” → saveProfile z weight_kg: 72.5, potem „Zapisano ✓”", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.type(screen.getByLabelText("Waga (kg)"), "72,5");
    expect(screen.getByText("Masz niezapisane zmiany.")).toBeInTheDocument();
    await userEvent.click(zapisz());
    expect(saveProfile).toHaveBeenCalledWith({
      display_name: "Mejson",
      timezone: "Europe/Warsaw",
      weight_kg: 72.5,
      height_cm: null,
    });
    expect(await screen.findByText("Zapisano ✓")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("ponowna zmiana po zapisie chowa „Zapisano ✓”", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.type(screen.getByLabelText("Wzrost (cm)"), "180");
    await userEvent.click(zapisz());
    await screen.findByText("Zapisano ✓");
    await userEvent.type(screen.getByLabelText("Wzrost (cm)"), "1");
    expect(screen.queryByText("Zapisano ✓")).not.toBeInTheDocument();
    expect(screen.getByText("Masz niezapisane zmiany.")).toBeInTheDocument();
  });

  it("„Cofnij” przywraca zapisane wartości", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.type(screen.getByLabelText("Wyświetlana nazwa"), "XYZ");
    await userEvent.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(screen.getByLabelText("Wyświetlana nazwa")).toHaveValue("Mejson");
    expect(screen.queryByRole("button", { name: "Cofnij" })).not.toBeInTheDocument();
  });

  it("zmiana strefy włącza zapis", async () => {
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    await userEvent.click(await screen.findByRole("option", { name: /Berlin/ }));
    await waitFor(() => expect(zapisz()).toBeEnabled());
  });

  it("błąd z serwera pokazuje się pod polem, bez „Zapisano”", async () => {
    saveProfile.mockResolvedValue({ ok: false, errors: { weight_kg: "Podaj liczbę 30–250." } });
    render(<ProfileCard saved={zapisane} timezones={strefy} />);
    await userEvent.type(screen.getByLabelText("Waga (kg)"), "70");
    await userEvent.click(zapisz());
    expect(await screen.findByText("Podaj liczbę 30–250.")).toBeInTheDocument();
    expect(screen.queryByText("Zapisano ✓")).not.toBeInTheDocument();
  });
});
