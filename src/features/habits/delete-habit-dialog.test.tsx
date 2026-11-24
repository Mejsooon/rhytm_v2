import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteHabitDialog } from "./delete-habit-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./actions", () => ({ deleteHabit: vi.fn() }));

describe("DeleteHabitDialog", () => {
  it("ikona kosza tylko na web, opis 14 px z cyframi tabelarycznymi na telefonie", () => {
    render(<DeleteHabitDialog habitId="h" name="Bieg" open onOpenChange={() => {}} />);
    const przycisk = screen.getByRole("button", { name: "Usuń" });
    expect(przycisk.querySelector("svg")).toHaveClass("max-[799px]:hidden");
    expect(screen.getByText("Historia odhaczeń i notatki zostaną usunięte.")).toHaveClass(
      "text-sm",
      "max-[799px]:tabular-nums",
    );
  });
});
