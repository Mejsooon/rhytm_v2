import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

// Przechwytuje propsy przekazane do Popover.Content Radixa
const zlapane = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));
vi.mock("radix-ui", async (importOriginal) => {
  const oryginal = await importOriginal<typeof import("radix-ui")>();
  const Content = (props: Record<string, unknown>) => {
    zlapane.props = props;
    return <oryginal.Popover.Content {...(props as object)} />;
  };
  return { ...oryginal, Popover: { ...oryginal.Popover, Content } };
});

import { ActionPopover } from "./action-popover";

describe("ActionPopover", () => {
  it("przekazuje avoidCollisions i collisionPadding 8 do Radixa", () => {
    render(
      <ActionPopover open onOpenChange={() => {}} trigger={<button>Otwórz</button>}>
        <div>Treść</div>
      </ActionPopover>,
    );
    expect(screen.getByText("Treść")).toBeInTheDocument();
    expect(zlapane.props?.avoidCollisions).toBe(true);
    expect(zlapane.props?.collisionPadding).toBe(8);
  });
});
