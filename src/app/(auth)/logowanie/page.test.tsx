import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/login-form", () => ({
  LoginForm: () => <form aria-label="logowanie" />,
}));

import LogowaniePage from "./page";

// Komponent pod Suspense (async Formularz) wywołany bezpośrednio
async function formularz(params: Record<string, string>) {
  const strona = LogowaniePage({
    searchParams: Promise.resolve(params),
  } as Parameters<typeof LogowaniePage>[0]);
  const zawieszony = strona.props.children.props.children;
  return zawieszony.type(zawieszony.props);
}

describe("/logowanie", () => {
  it("?konto=usuniete → komunikat nad formularzem", async () => {
    render(await formularz({ konto: "usuniete" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Konto oznaczone do usunięcia. Przez 30 dni możesz je przywrócić — wystarczy się zalogować.",
    );
  });

  it("bez parametru → bez komunikatu", async () => {
    render(await formularz({}));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
