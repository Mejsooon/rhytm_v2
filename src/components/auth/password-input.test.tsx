import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  it("zostawia miejsce na przycisk „Pokaż hasło” po prawej", () => {
    render(<PasswordInput name="haslo" label="Hasło" autoComplete="current-password" />);
    expect(screen.getByLabelText("Hasło")).toHaveClass(
      "pr-11",
      "max-[799px]:pr-[52px]",
    );
  });
});
