import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/link-expired", () => ({
  LinkExpired: () => null,
}));

import { AuthShell } from "@/components/auth/auth-shell";

import LinkWygaslPage from "./page";

describe("/link-wygasl", () => {
  it("statyczna ramka konta z akcją „Zaloguj się” i stopką, treść pod Suspense", () => {
    const strona = LinkWygaslPage({
      searchParams: Promise.resolve({}),
    } as Parameters<typeof LinkWygaslPage>[0]);
    // Ramka jest korzeniem strony (wstępnie renderowana), nie częścią komponentu pod Suspense
    expect(strona.type).toBe(AuthShell);
    expect(strona.props.headerAction).toEqual({
      href: "/logowanie",
      label: "Zaloguj się",
    });
    render(strona.props.footer);
    const stopka = screen.getByText("Nowy link będzie ważny 1 godzinę.");
    expect(stopka).toHaveClass("text-xs");
  });
});
