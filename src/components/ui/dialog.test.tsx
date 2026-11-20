import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

describe("ui/dialog — DialogContent", () => {
  it("✕ jak .btng.ic.sm z makiet: 28 px bez ramki, nazwa „Zamknij”, na telefonie cel 44 px", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Okno</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const zamknij = screen.getByRole("button", { name: "Zamknij" });
    expect(zamknij).toHaveClass(
      "h-7",
      "w-7",
      "border-transparent",
      "bg-transparent",
      "hover:bg-accent",
      "max-[799px]:size-11",
      "absolute",
    );
    expect(zamknij.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
