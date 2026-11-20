import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("primary ma klasy COSS", () => {
    render(<Button variant="primary">Zaloguj się</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
      "border-primary",
    );
  });

  it("md na telefonie ma 44 px", () => {
    render(<Button>Zmień</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-[799px]:h-11");
  });

  it("sm na telefonie ma 40 px", () => {
    render(<Button size="sm">Zmień</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-[799px]:h-10");
  });

  it("wyłączony przycisk jest nieaktywny i przygaszony", () => {
    render(<Button disabled>Zapisz</Button>);
    const przycisk = screen.getByRole("button");
    expect(przycisk).toBeDisabled();
    expect(przycisk).toHaveClass("disabled:opacity-[.64]");
  });

  it("aria-disabled też jest przygaszony", () => {
    render(<Button aria-disabled="true">Zapisz</Button>);
    expect(screen.getByRole("button")).toHaveClass("aria-disabled:opacity-[.64]");
  });

  it("fokus z klawiatury rysuje podwójny pierścień", () => {
    render(<Button>Zmień</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)]",
    );
  });

  it("primary jako link zachowuje jasny tekst", () => {
    render(
      <Button asChild variant="primary">
        <a href="/x">X</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "X" });
    expect(link.tagName).toBe("A");
    expect(link).toHaveClass("hover:bg-primary-hover", "hover:text-primary-foreground");
  });

  it("destructive ma kolor tokenu destructive", () => {
    render(<Button variant="destructive">Usuń konto</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive", "border-destructive");
  });

  it("destructive-outline ma czerwony tekst", () => {
    render(<Button variant="destructive-outline">Usuń</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-destructive-foreground");
  });

  it("soft ma szare tło", () => {
    render(<Button variant="soft">Więcej</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-muted");
  });

  it("ghost jest przezroczysty", () => {
    render(<Button variant="ghost">Anuluj</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-transparent");
  });

  it("domyślnie secondary", () => {
    render(<Button>Zmień</Button>);
    expect(screen.getByRole("button")).toHaveClass("border-input", "bg-white");
  });

  it("xs i lg mają wysokości 24 i 36 px", () => {
    render(
      <>
        <Button size="xs">A</Button>
        <Button size="lg">B</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "A" })).toHaveClass("h-6");
    expect(screen.getByRole("button", { name: "B" })).toHaveClass("h-9");
  });

  it("icon jest kwadratowy", () => {
    render(
      <Button size="sm" icon aria-label="Menu">
        ⋯
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass("w-7", "px-0");
  });
});
