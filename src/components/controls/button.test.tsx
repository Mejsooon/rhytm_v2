import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("primary ma tło #171717 i biały tekst", () => {
    render(<Button variant="primary">Zaloguj się</Button>);
    const klasy = screen.getByRole("button").className;
    expect(klasy).toContain("bg-[#171717]");
    expect(klasy).toContain("text-white");
  });

  it("asChild renderuje <a> z hoverem #2e2e2e i zachowanym białym tekstem", () => {
    render(
      <Button asChild variant="primary">
        <a href="/x">X</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "X" });
    expect(link.tagName).toBe("A");
    expect(link.className).toContain("hover:bg-[#2e2e2e]");
    expect(link.className).toContain("hover:text-white");
  });

  it("destructive ma kolor #b91c1c", () => {
    render(<Button variant="destructive">Usuń konto</Button>);
    expect(screen.getByRole("button").className).toContain("#b91c1c");
  });

  it("domyślnie secondary", () => {
    render(<Button>Zmień</Button>);
    expect(screen.getByRole("button").className).toContain("border-[#e0e0e0]");
  });
});
