import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace, createGymSession, saveRun } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  createGymSession: vi.fn(),
  saveRun: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./actions", () => ({
  createGymSession,
  deleteSession: vi.fn(),
  skipTemplateOccurrence: vi.fn(),
  saveRun,
}));

import { daneSportu } from "./sport-test-data";
import { SportView } from "./sport-view";

const BIEG = "a1000000-0000-4000-8000-000000000015";
const telefon = () => screen.getByTestId("m-sport");

// Udajemy szerokość telefonu dla matchMedia (jsdom jej nie ma)
function ustawTelefon(tel: boolean) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: tel }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  createGymSession.mockResolvedValue({ ok: true, id: "nowa-sesja" });
  saveRun.mockResolvedValue({ ok: true });
});
afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("SportView na telefonie", () => {
  it("oba układy w DOM, przełączane klasami 800 px", () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    expect(telefon().className).toContain("min-[800px]:hidden");
    expect(screen.getByTestId("web-sport").className).toContain(
      "max-[799px]:hidden",
    );
  });

  it("„Bieg” przechodzi na adres nowego biegu (ten sam co web)", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: "Bieg" }),
    );
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/sport\?miesiac=2026-11&nowy=bieg&data=2026-11-17&godzina=\d\d:\d\d$/,
      ),
      { scroll: false },
    );
  });

  it("„Trening” tworzy pusty trening na dziś i otwiera ekran treningu", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: "Trening" }),
    );
    expect(createGymSession).toHaveBeenCalledWith({
      date: "2026-11-17",
      start: expect.stringMatching(/^\d\d:\d\d$/),
    });
    expect(push).toHaveBeenCalledWith("/sport/trening/nowa-sesja");
  });

  it("?nowy=bieg poniżej 800 px otwiera arkusz MRunNew zamiast okna web", async () => {
    ustawTelefon(true);
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        newRun={{ date: "2026-11-17", start: "16:00" }}
      />,
    );
    const okno = screen.getByRole("dialog", { name: "Nowy bieg" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeVisible();
    expect(
      within(okno).queryByRole("button", { name: "Zapisz bieg" }),
    ).not.toBeInTheDocument();
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 799px)");

    // Anuluj czyści adres (miesiąc zostaje) i chowa arkusz
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(replace).toHaveBeenCalledWith("/sport?miesiac=2026-11", {
      scroll: false,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("?bieg={id} poniżej 800 px: arkusz edycji z danymi biegu", () => {
    ustawTelefon(true);
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        runId={BIEG}
      />,
    );
    const okno = screen.getByRole("dialog", { name: "Edytuj bieg" });
    expect(
      within(okno).getByRole("textbox", { name: "Dystans (km)" }),
    ).toHaveValue("12,0");
  });

  it("od 800 px ten sam adres otwiera okno web", () => {
    ustawTelefon(false);
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        newRun={{ date: "2026-11-17", start: "16:00" }}
      />,
    );
    const okno = screen.getByRole("dialog", { name: "Nowy bieg" });
    expect(
      within(okno).getByRole("button", { name: "Zapisz bieg" }),
    ).toBeInTheDocument();
  });

  it("„Ostatnie” na telefonie: bieg otwiera adres okna biegu", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: /Długi bieg · 12,0 km/ }),
    );
    expect(push).toHaveBeenCalledWith(`/sport?miesiac=2026-11&bieg=${BIEG}`, {
      scroll: false,
    });
  });
});
