import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "sans" } }));
vi.mock("geist/font/mono", () => ({ GeistMono: { variable: "mono" } }));

import RootLayout from "@/app/layout";
import { Toaster } from "./sonner";

describe("Toaster", () => {
  it("pokazuje toast na dole pośrodku, z odstępem --toast-bottom", async () => {
    const { container } = render(<Toaster />);
    act(() => {
      toast.success("Dodano");
    });
    expect(await screen.findByText("Dodano")).toBeInTheDocument();
    const lista = container.querySelector(
      "[data-sonner-toaster]",
    ) as HTMLElement;
    expect(lista).toHaveAttribute("data-y-position", "bottom");
    expect(lista).toHaveAttribute("data-x-position", "center");
    expect(lista.style.getPropertyValue("--offset-bottom")).toBe(
      "var(--toast-bottom)",
    );
    expect(lista.style.getPropertyValue("--mobile-offset-bottom")).toBe(
      "var(--toast-bottom)",
    );
  });

  it("główny layout montuje Toaster w całej aplikacji", () => {
    const html = renderToStaticMarkup(
      RootLayout({ children: <p>treść</p> } as Parameters<
        typeof RootLayout
      >[0]),
    );
    // Sonner renderuje region powiadomień (section z aria-label „Notifications …”)
    expect(html).toMatch(/<section[^>]*aria-label="Notifications/);
    expect(html).toContain("treść");
  });
});
