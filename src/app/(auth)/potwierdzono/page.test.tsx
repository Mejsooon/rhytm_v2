import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PotwierdzonoPage from "./page";

describe("/potwierdzono", () => {
  it("kafelek ikony w tonie sukcesu, stopka „Link był jednorazowy i już wygasł.” w pasku, bez font-mono", () => {
    const { container } = render(<PotwierdzonoPage />);
    const kafelek = container.querySelector("svg.lucide")?.parentElement;
    expect(kafelek).toHaveClass(
      "size-10",
      "bg-success-soft",
      "border-success-border",
      "text-success",
    );
    const stopka = screen.getByText("Link był jednorazowy i już wygasł.");
    expect(stopka.closest(".border-t")).not.toBeNull();
    expect(container.querySelector(".font-mono")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "text-xl",
      "font-semibold",
    );
    expect(screen.getByRole("link", { name: "Dalej" })).toHaveClass("h-9");
    expect(screen.getByRole("link", { name: "Dalej" })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });
});
