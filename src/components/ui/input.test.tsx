import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("telefon: font 16 px i wysokość 44 px, web 32 px bez zmian", () => {
    render(<Input aria-label="Nazwa" />);
    const pole = screen.getByRole("textbox", { name: "Nazwa" });
    expect(pole).toHaveClass("h-8", "text-sm", "max-[799px]:h-11", "max-[799px]:text-base");
    expect(pole).not.toHaveClass("max-[799px]:text-[15px]");
  });
});
