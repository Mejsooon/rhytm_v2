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

  it("placement=header: nie renderuje się przy rozwiniętym pasku", () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <SidebarToggle placement="header" />
      </SidebarStateProvider>,
    );
    expect(screen.queryByRole("button", { name: "Pokaż pasek boczny" })).toBeNull();
  });

  it("placement=header: przy schowanym pasku pokazuje i rozwija pasek", async () => {
    render(
      <SidebarStateProvider initialCollapsed>
        <SidebarToggle placement="header" />
      </SidebarStateProvider>,
    );
    const przycisk = screen.getByRole("button", { name: "Pokaż pasek boczny" });
    expect(przycisk).toHaveClass("max-[799px]:hidden");
    await userEvent.click(przycisk);
    expect(screen.queryByRole("button", { name: "Pokaż pasek boczny" })).toBeNull();
  });
});
