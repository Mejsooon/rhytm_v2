import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarStateProvider, useSidebarState } from "./sidebar-state";

function Sonda() {
  const { collapsed, toggle } = useSidebarState();
  return (
    <>
      <span data-testid="stan">{collapsed ? "schowany" : "rozwiniety"}</span>
      <button type="button" onClick={toggle}>
        przełącz
      </button>
      <input aria-label="pole" defaultValue="abc" />
    </>
  );
}

afterEach(() => {
  document.cookie = "rhytm_sidebar=; path=/; max-age=0";
});

describe("SidebarStateProvider", () => {
  it("startuje ze stanu z serwera", () => {
    render(
      <SidebarStateProvider initialCollapsed>
        <Sonda />
      </SidebarStateProvider>,
    );
    expect(screen.getByTestId("stan")).toHaveTextContent("schowany");
  });

  it("toggle przełącza stan i zapisuje ciasteczko rhytm_sidebar", async () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <Sonda />
      </SidebarStateProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "przełącz" }));
    expect(screen.getByTestId("stan")).toHaveTextContent("schowany");
    expect(document.cookie).toContain("rhytm_sidebar=collapsed");

    await userEvent.click(screen.getByRole("button", { name: "przełącz" }));
    expect(screen.getByTestId("stan")).toHaveTextContent("rozwiniety");
    expect(document.cookie).toContain("rhytm_sidebar=open");
  });

  it("Ctrl+\\ w polu tekstowym przełącza stan i nie zmienia wartości pola", () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <Sonda />
      </SidebarStateProvider>,
    );
    const pole = screen.getByLabelText("pole");
    pole.focus();
    const zdarzenie = fireEvent.keyDown(pole, { key: "\\", ctrlKey: true });
    // fireEvent zwraca false, gdy ktoś wywołał preventDefault
    expect(zdarzenie).toBe(false);
    expect(screen.getByTestId("stan")).toHaveTextContent("schowany");
    expect(pole).toHaveValue("abc");
  });

  it("⌘+\\ (metaKey) też przełącza, a sam \\ nie", () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <Sonda />
      </SidebarStateProvider>,
    );
    fireEvent.keyDown(window, { key: "\\" });
    expect(screen.getByTestId("stan")).toHaveTextContent("rozwiniety");
    fireEvent.keyDown(window, { key: "\\", metaKey: true });
    expect(screen.getByTestId("stan")).toHaveTextContent("schowany");
  });
});
