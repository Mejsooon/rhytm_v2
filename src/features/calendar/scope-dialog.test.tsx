import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScopeDialog } from "./scope-dialog";

function wyrenderuj(
  extra: Partial<React.ComponentProps<typeof ScopeDialog>> = {},
) {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  render(
    <ScopeDialog
      subtitle="„rhytm — kod” · co tydzień"
      date="2026-11-17"
      timeLabel="10:00–12:30"
      onPick={onPick}
      onCancel={onCancel}
      {...extra}
    />,
  );
  return { onPick, onCancel };
}

describe("ScopeDialog", () => {
  it("pokazuje 3 opcje z opisami i zdanie o zadaniach", () => {
    wyrenderuj();
    expect(
      screen.getByRole("dialog", {
        name: "Zmieniasz blok, który się powtarza",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeChecked();
    expect(
      screen.getByText(
        "wt 17.11 · 10:00–12:30. Inne tygodnie zostają bez zmian.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Od 17.11 w przód. Wcześniejsze wystąpienia zostają."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Zmieni całą serię, także przeszłe tygodnie."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Zadania z odhaczonych wystąpień nie przepadają."),
    ).toBeInTheDocument();
  });

  it("„To i następne” + „Zapisz zmianę” woła onPick('following')", async () => {
    const { onPick } = wyrenderuj();
    await userEvent.click(screen.getByLabelText(/To i następne/));
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(onPick).toHaveBeenCalledWith("following");
  });

  it("Anuluj woła onCancel i nie wybiera zakresu", async () => {
    const { onPick, onCancel } = wyrenderuj();
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("disableThis wyłącza „Tylko to wystąpienie”, pokazuje podpowiedź i wybiera „To i następne”", async () => {
    const { onPick } = wyrenderuj({
      disableThis:
        "Kategoria, notatka i przypomnienie zmieniają się dla całej serii.",
    });
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeDisabled();
    expect(
      screen.getByText(
        "Kategoria, notatka i przypomnienie zmieniają się dla całej serii.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/To i następne/)).toBeChecked();
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(onPick).toHaveBeenCalledWith("following");
  });

  it("tryb usuwania ma własny tytuł i przycisk „Usuń”; błąd widać w oknie", async () => {
    const { onPick } = wyrenderuj({
      intent: "delete",
      error: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    expect(
      screen.getByRole("dialog", { name: "Usuwasz blok, który się powtarza" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nie udało się zapisać. Spróbuj ponownie."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onPick).toHaveBeenCalledWith("this");
  });
  it("disableAll i disableFollowing z tą samą podpowiedzią: wybór „Tylko to”, podpowiedź raz", async () => {
    const podpowiedz =
      "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.";
    const { onPick } = wyrenderuj({
      disableFollowing: podpowiedz,
      disableAll: podpowiedz,
    });
    expect(screen.getByLabelText(/To i następne/)).toBeDisabled();
    expect(screen.getByLabelText(/Wszystkie wystąpienia/)).toBeDisabled();
    expect(screen.getAllByText(podpowiedz)).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(onPick).toHaveBeenCalledWith("this");
  });

  it("wszystkie opcje wyłączone: zapis niedostępny", () => {
    wyrenderuj({ disableThis: "A", disableFollowing: "B", disableAll: "B" });
    expect(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    ).toBeDisabled();
  });

  it("wygląd jak w CScopeDialog: karty opcji 12 px, wybrana z obwódką, zdanie o zadaniach w ramce info", () => {
    wyrenderuj({ disableAll: "B" });
    const wybrana = screen.getByLabelText(/Tylko to wystąpienie/).closest("label");
    expect(wybrana).toHaveClass(
      "rounded-lg",
      "border-black/[.24]",
      "bg-black/[.025]",
      "shadow-[0_0_0_1px_rgba(0,0,0,.12)]",
    );
    const zwykla = screen.getByLabelText(/To i następne/).closest("label");
    expect(zwykla).toHaveClass("border-input", "bg-white", "shadow-xs");
    const wylaczona = screen.getByLabelText(/Wszystkie wystąpienia/).closest("label");
    expect(wylaczona).toHaveClass("opacity-[.64]", "cursor-not-allowed");
    // Radio jak w coss.css: 16 px, zaznaczone = gruba ciemna obwódka
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toHaveClass(
      "appearance-none",
      "size-4",
      "checked:border-[5px]",
      "checked:border-primary",
    );
    const info = screen.getByText(
      "Zadania z odhaczonych wystąpień nie przepadają.",
    );
    expect(info).toHaveClass("border-info-border", "rounded-lg", "text-[13px]");
    expect(info).not.toHaveClass("font-mono");
  });
});
