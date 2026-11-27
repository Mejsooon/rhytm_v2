import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Powłoka woła Supabase — w teście zastępujemy ją samym opakowaniem
vi.mock("@/components/shell/app-shell", () => ({
  AppShell: ({
    children,
    requireUser,
  }: {
    children: React.ReactNode;
    requireUser?: boolean;
  }) => (
    <div data-testid="powloka" data-require-user={String(requireUser)}>
      {children}
    </div>
  ),
}));

import NotFound from "./not-found";

describe("404", () => {
  it("okruszki bez font-mono, jak topbar/crumb z makiety", () => {
    const { container } = render(<NotFound />);
    const nav = screen.getByRole("navigation", { name: "Okruszki" });
    expect(nav).toHaveClass("text-sm", "text-muted-foreground");
    expect(nav).not.toHaveClass("font-mono");
    expect(screen.getByText("404", { selector: "nav b" })).toHaveClass(
      "font-medium",
      "text-foreground",
    );
    expect(nav.closest("header")).toHaveClass("border-b", "px-6", "py-2.5");
    expect(container.querySelector(".font-mono")).toBeNull();
  });

  it("dokładnie jeden h1, a bieżący okruszek ma aria-current", () => {
    render(<NotFound />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("404", { selector: "nav b" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("liczba 404 bez font-mono, rozmiar wg makiety", () => {
    render(<NotFound />);
    const liczba = screen.getByText("404", { selector: "span" });
    expect(liczba).toHaveClass(
      "text-[64px]",
      "font-semibold",
      "tabular-nums",
      "leading-none",
    );
    expect(liczba).not.toHaveClass("font-mono");
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "text-[22px]",
      "font-semibold",
    );
  });

  it("przyciski „Wróć do Dziś” (primary) i „Szukaj ⌘K” (otwiera okno) w rozmiarze z makiety", () => {
    render(<NotFound />);
    const wroc = screen.getByRole("link", { name: "Wróć do Dziś" });
    expect(wroc).toHaveAttribute("href", "/dzis");
    expect(wroc).toHaveClass("bg-primary", "h-8");
    const szukaj = screen.getByRole("button", { name: /Szukaj/ });
    expect(szukaj).not.toHaveAttribute("aria-disabled");
    expect(szukaj).toHaveClass("h-8");
    const kbd = screen.getByText("⌘K");
    expect(kbd.tagName).toBe("KBD");
    expect(kbd).not.toHaveClass("font-mono");
  });

  it("link do kosza zostaje (/ustawienia/kosz)", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "kosza" })).toHaveAttribute(
      "href",
      "/ustawienia/kosz",
    );
  });

  it("gość: treść bez powłoki (requireUser=false)", () => {
    render(<NotFound />);
    expect(screen.getByTestId("powloka")).toHaveAttribute(
      "data-require-user",
      "false",
    );
    expect(screen.getByText("Tej strony nie ma")).toBeInTheDocument();
  });
});
