import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SidebarStateProvider } from "./sidebar-state";
import { SidebarToggle } from "./sidebar-toggle";

describe("SidebarToggle", () => {
  it("placement=sidebar: przycisk „Schowaj pasek boczny” ze skrótem w title", async () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <SidebarToggle placement="sidebar" />
      </SidebarStateProvider>,
    );
    const przycisk = screen.getByRole("button", { name: "Schowaj pasek boczny" });
    expect(przycisk.getAttribute("title")).toMatch(/(Ctrl|⌘)\+\\/);
    expect(przycisk).toHaveClass("max-[799px]:hidden");
    await userEvent.click(przycisk);
  });

  it("placement=rail: przycisk 36 px „Pokaż pasek boczny” rozwija pasek", async () => {
    render(
      <SidebarStateProvider initialCollapsed>
        <SidebarToggle placement="rail" />
      </SidebarStateProvider>,
    );
    const przycisk = screen.getByRole("button", { name: "Pokaż pasek boczny" });
    expect(przycisk).toHaveClass("size-9");
    expect(przycisk.getAttribute("title")).toMatch(/Pokaż pasek boczny · (Ctrl|⌘)\+\\/);
    await userEvent.click(przycisk);
  });
});
