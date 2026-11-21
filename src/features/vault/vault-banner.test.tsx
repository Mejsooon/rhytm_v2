import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./vault-provider", () => ({ useVault: () => vault.state }));

import { VaultBanner } from "./vault-banner";

describe("VaultBanner", () => {
  it("zablokowany", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    render(<VaultBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Sejf zablokowany");
    expect(screen.getByText("serwer widzi tylko szyfrogram")).toBeInTheDocument();
  });

  it("odblokowany: odliczanie mm:ss zaokrąglane w górę", () => {
    vault.state = { status: "odblokowany", remainingMs: 61_000 };
    render(<VaultBanner />);
    expect(screen.getByText("blokada za 01:01")).toBeInTheDocument();
  });

  it("odblokowany: licznik nie jest w regionie live", () => {
    vault.state = { status: "odblokowany", remainingMs: 61_000 };
    render(<VaultBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("Sejf odblokowany");
    expect(screen.getByRole("status")).not.toHaveTextContent("blokada za");
  });

  it("brak, ładowanie: nic", () => {
    for (const status of ["brak", "ladowanie"]) {
      vault.state = { status, remainingMs: 0 };
      const { container } = render(<VaultBanner />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("nieobsługiwany: komunikat", () => {
    vault.state = { status: "nieobslugiwany", remainingMs: 0 };
    render(<VaultBanner />);
    expect(screen.getByText("Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.")).toBeInTheDocument();
  });
});
