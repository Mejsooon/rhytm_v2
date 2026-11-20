import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("ton green: zielone tło i tekst", () => {
    render(<StatusBadge tone="green">OK</StatusBadge>);
    expect(screen.getByText("OK")).toHaveClass(
      "bg-success-soft",
      "text-success",
    );
  });

  it("ton outline: biała z ramką", () => {
    render(<StatusBadge tone="outline">Out</StatusBadge>);
    expect(screen.getByText("Out")).toHaveClass("border-input", "bg-white");
  });

  it("ton dark: ciemne tło", () => {
    render(<StatusBadge tone="dark">Dark</StatusBadge>);
    expect(screen.getByText("Dark")).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
  });

  it("size lg ma 22 px, domyślnie 18 px", () => {
    render(
      <>
        <StatusBadge tone="gray" size="lg">
          Duża
        </StatusBadge>
        <StatusBadge tone="gray">Mała</StatusBadge>
      </>,
    );
    expect(screen.getByText("Duża")).toHaveClass("h-[22px]");
    expect(screen.getByText("Mała")).toHaveClass("h-[18px]");
  });
});
