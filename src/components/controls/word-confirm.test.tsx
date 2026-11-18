import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WordConfirm } from "./word-confirm";

function ustaw(onConfirm = vi.fn()) {
  render(
    <WordConfirm
      word="RESETUJ"
      label="Wpisz RESETUJ, żeby potwierdzić"
      confirmLabel="Zresetuj sejf"
      destructive
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("WordConfirm", () => {
  it("przy niepełnym słowie przycisk ma aria-disabled i nie reaguje", async () => {
    const onConfirm = ustaw();
    await userEvent.type(screen.getByRole("textbox"), "RESE");
    const btn = screen.getByRole("button", { name: "Zresetuj sejf" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("po poprawnym słowie klik woła onConfirm raz", async () => {
    const onConfirm = ustaw();
    await userEvent.type(screen.getByRole("textbox"), "resetuj");
    const btn = screen.getByRole("button", { name: "Zresetuj sejf" });
    expect(btn).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
