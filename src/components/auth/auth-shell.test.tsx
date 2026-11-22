import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "./auth-shell";

describe("AuthShell", () => {
  it("web: tło bez siatki", () => {
    const { container } = render(<AuthShell>treść</AuthShell>);
    const korzen = container.firstElementChild as HTMLElement;
    expect(korzen.className).not.toContain("linear-gradient");
    expect(korzen.className).not.toContain("bg-[length:48px_48px]");
    expect(korzen).toHaveClass("min-[800px]:bg-panel");
  });

  it("headerNote jako szara odznaka bez font-mono", () => {
    render(<AuthShell headerNote="krok 1 / 3">treść</AuthShell>);
    const nota = screen.getByText("krok 1 / 3");
    expect(nota).not.toHaveClass("font-mono");
    expect(nota).toHaveClass("bg-muted", "text-foreground", "h-[22px]", "tabular-nums");
  });

  it("akcja nagłówka jako przycisk outline 32 px", () => {
    render(
      <AuthShell headerAction={{ href: "/rejestracja", label: "Załóż konto" }}>
        treść
      </AuthShell>,
    );
    const link = screen.getByRole("link", { name: "Załóż konto" });
    expect(link).toHaveAttribute("href", "/rejestracja");
    expect(link).toHaveClass("border-input", "bg-white", "h-8", "rounded-md");
  });

  it("karta: ramka, promień i cień z tokenów", () => {
    render(<AuthShell>treść</AuthShell>);
    const karta = screen.getByText("treść");
    expect(karta).toHaveClass("rounded-xl", "border-border", "shadow-card");
    expect(karta.className).not.toContain("rgba(");
  });

  it("footer renderuje pasek stopki karty", () => {
    render(<AuthShell footer="Link był jednorazowy">treść</AuthShell>);
    const stopka = screen.getByText("Link był jednorazowy");
    expect(stopka).toHaveClass("border-t", "bg-black/[.025]", "justify-center", "text-[13px]", "text-muted-foreground");
    expect(stopka).toHaveClass("rounded-b-[15px]");
  });

  it("brak footer i progress nie dodaje elementów", () => {
    const { container } = render(<AuthShell>treść</AuthShell>);
    expect(container.querySelector("[data-testid='auth-progress']")).toBeNull();
    expect(container.querySelector(".border-t")).toBeNull();
  });

  it("progress renderuje total segmentów, step wypełnionych", () => {
    render(<AuthShell progress={{ step: 2, total: 3 }}>treść</AuthShell>);
    const pasek = screen.getByTestId("auth-progress");
    expect(pasek).toHaveAttribute("aria-hidden", "true");
    expect(pasek.children).toHaveLength(3);
    expect(pasek.children[0]).toHaveClass("bg-foreground");
    expect(pasek.children[1]).toHaveClass("bg-foreground");
    expect(pasek.children[2]).toHaveClass("bg-border");
    expect(pasek.children[2]).not.toHaveClass("bg-foreground");
  });

  it("telefon bez zmian", () => {
    render(
      <AuthShell phoneBack="/logowanie" footer="stopka">
        treść
      </AuthShell>,
    );
    const karta = screen.getByText("treść");
    expect(karta).toHaveClass(
      "max-[799px]:border-0",
      "max-[799px]:shadow-none",
      "max-[799px]:rounded-none",
      "max-[799px]:px-6",
      "max-[799px]:pb-6",
      "max-[799px]:pt-2",
    );
    expect(screen.getByRole("link", { name: "Wstecz" })).toHaveAttribute("href", "/logowanie");
  });

  it("telefon bez powrotu: margines górny 56 px", () => {
    render(<AuthShell>treść</AuthShell>);
    expect(screen.getByText("treść")).toHaveClass("max-[799px]:pt-14");
  });
});
