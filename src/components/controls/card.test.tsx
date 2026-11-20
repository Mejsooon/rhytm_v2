import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardFooter } from "./card";

describe("Card", () => {
  it("karta ma ramkę i promień 16 px", () => {
    render(<Card data-testid="karta">treść</Card>);
    expect(screen.getByTestId("karta")).toHaveClass(
      "rounded-xl",
      "border-border",
      "shadow-xs",
    );
  });

  it("CardFooter ma szare tło", () => {
    render(<CardFooter data-testid="stopka">stopka</CardFooter>);
    expect(screen.getByTestId("stopka")).toHaveClass(
      "bg-black/[.025]",
      "border-t",
    );
  });
});
