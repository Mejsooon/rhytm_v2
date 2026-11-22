import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => (
    <input type="hidden" name="cf-turnstile-response" value="token" />
  ),
}));

vi.mock("./actions", () => ({
  signUp: vi.fn(async () => {
    // Chwila opóźnienia, żeby było widać stan „w trakcie”
    await new Promise((r) => setTimeout(r, 50));
    return { status: "success", email: "ala@przyklad.pl" };
  }),
  signInWithGoogle: vi.fn(async () => undefined),
  checkPasswordLeak: vi.fn(async () => false),
  resendConfirmation: vi.fn(async () => ({ status: "success" })),
}));

import { checkPasswordLeak, signUp } from "./actions";
import { RegisterForm } from "./register-form";

// Kolor wariantu telefonu (PhoneStrengthBar zostaje na hexach do Etapu 3)
const KOLOR_OK = "#15803d";

async function wpiszHaslo(
  user: ReturnType<typeof userEvent.setup>,
  haslo: string,
) {
  await user.type(screen.getByLabelText("Hasło"), haslo);
  // Debounce 400 ms + odpowiedź akcji
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450));
  });
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPasswordLeak).mockResolvedValue(false);
  });

  it("rytm2026: długość ○, litery i cyfry ✓", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "rytm2026");
    expect(screen.getByText(/co najmniej 10 znaków/)).toHaveTextContent(": niespełnione");
    expect(screen.getByText(/litery i cyfry/)).toHaveTextContent(": spełnione");
  });

  it("wyciek (checkPasswordLeak → true): reguła ○ i blokada wysyłki", async () => {
    vi.mocked(checkPasswordLeak).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "haslo12345");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/nie ma go w bazie wycieków/)).toHaveTextContent(
      ": niespełnione",
    );
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    await user.click(przycisk);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("pasek siły ma 4 segmenty; rytmtygodnia2026x → wszystkie bg-success", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "rytmtygodnia2026x");
    const segmenty = screen.getAllByTestId("strength-segment");
    expect(segmenty).toHaveLength(4);
    for (const s of segmenty)
      expect(s).toHaveClass("bg-success");
  });

  it("bez zgody „Utwórz konto” ma aria-disabled i nie wysyła; linki do regulaminu i prywatności", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "rytm2026dobre");
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    await user.click(przycisk);
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "regulamin" })).toHaveAttribute(
      "href",
      "/regulamin",
    );
    expect(
      screen.getByRole("link", { name: "politykę prywatności" }),
    ).toHaveAttribute("href", "/prywatnosc");
  });

  it("podwójne kliknięcie: akcja 1 raz, przycisk zablokowany w trakcie; potem „Sprawdź skrzynkę”", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "rytm2026dobre");
    await user.click(screen.getByRole("checkbox"));
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).not.toHaveAttribute("aria-disabled", "true");
    await user.dblClick(przycisk);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(vi.mocked(signUp).mock.calls[0][1].get("tos")).toBe("on");
    expect(screen.getByRole("button", { name: "Utwórz konto" })).toBeDisabled();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Sprawdź skrzynkę" }),
      ).toBeInTheDocument(),
    );
  });

  it("telefon: podpowiedź siły, placeholdery i ukryta lista reguł z właściwymi klasami breakpointów", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    // Lista reguł tylko na webie, podpis siły tylko na telefonie
    expect(screen.getByText(/co najmniej 10 znaków/).closest("ul")).toHaveClass(
      "max-[799px]:hidden",
    );
    const hint = screen.getByTestId("pw-hint");
    expect(hint).toHaveTextContent("10+ znaków, wielka litera, cyfra, znak");
    expect(hint.parentElement).toHaveClass("min-[800px]:hidden");
    // Placeholdery: telefon w polu, web w nakładce ukrywanej na telefonie
    expect(screen.getByLabelText("Hasło")).toHaveAttribute(
      "placeholder",
      "Min. 10 znaków",
    );
    expect(screen.getByText("Wpisz, żeby zobaczyć wymagania")).toHaveClass(
      "max-[799px]:hidden",
    );
    expect(screen.getByLabelText(/Nazwa/)).toHaveAttribute(
      "placeholder",
      "Jak mamy się do ciebie zwracać?",
    );
    expect(screen.getByText("Jak mamy się do Ciebie zwracać?")).toHaveClass(
      "max-[799px]:hidden",
    );
    // Punktacja telefonu: Rytm2026! = długość 10 + wielka litera + cyfra + znak = 4 -> Mocne, wszystkie #15803d
    await user.type(screen.getByLabelText("Hasło"), "Rytm2026!!");
    expect(hint).toHaveTextContent("Mocne hasło");
    const seg = screen.getAllByTestId("strength-segment-m");
    expect(seg).toHaveLength(4);
    for (const s of seg) expect(s).toHaveStyle({ backgroundColor: KOLOR_OK });
    // Poziom 3 = #ca8a04 ("Dobre")
    await user.clear(screen.getByLabelText("Hasło"));
    await user.type(screen.getByLabelText("Hasło"), "rytm2026!!");
    expect(hint).toHaveTextContent("Dobre hasło");
    expect(screen.getAllByTestId("strength-segment-m")[2]).toHaveStyle({
      backgroundColor: "#ca8a04",
    });
  });

  it("telefon: hasło z wycieku ma widoczny powód pod paskiem siły (tylko < 800 px)", async () => {
    vi.mocked(checkPasswordLeak).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "haslo12345");
    const powod = screen.getByText(
      "To hasło wyciekło w innym serwisie. Wybierz inne.",
    );
    expect(powod).toHaveClass("min-[800px]:hidden");
  });

  it("bez wycieku nie ma tekstu o wycieku", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "rytm2026dobre");
    expect(
      screen.queryByText("To hasło wyciekło w innym serwisie. Wybierz inne."),
    ).not.toBeInTheDocument();
  });

  it("błąd checkPasswordLeak (sieć) → stan wycieku zostaje nieznany, bez blokady i bez nieobsłużonego błędu", async () => {
    vi.mocked(checkPasswordLeak).mockRejectedValue(new Error("sieć"));
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.click(screen.getByRole("checkbox"));
    await wpiszHaslo(user, "rytm2026dobre");
    expect(checkPasswordLeak).toHaveBeenCalled();
    expect(screen.getByText(/nie ma go w bazie wycieków/)).toHaveTextContent(
      ": niespełnione",
    );
    expect(
      screen.queryByText("To hasło wyciekło w innym serwisie. Wybierz inne."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Utwórz konto" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("po błędzie akcji pole hasła nadal pokazuje to samo hasło co reguły (bez rozjazdu stanu)", async () => {
    vi.mocked(signUp).mockResolvedValueOnce({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "rytm2026dobre");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Utwórz konto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Potwierdź, że nie jesteś botem",
    );
    expect(screen.getByLabelText("Hasło")).toHaveValue("rytm2026dobre");
    expect(screen.getByText(/co najmniej 10 znaków/)).toHaveTextContent(": spełnione");
  });

  it("pasek siły hasła i lista reguł wg CRegister bez font-mono", async () => {
    const user = userEvent.setup();
    const { container } = render(<RegisterForm />);
    await user.type(screen.getByLabelText("Hasło"), "rytm2026ab");
    expect(container.querySelector(".font-mono")).toBeNull();
    // Segmenty paska 6 px (h-1.5), lista reguł 13 px
    for (const s of screen.getAllByTestId("strength-segment"))
      expect(s).toHaveClass("h-1.5", "rounded-full");
    expect(screen.getByText(/co najmniej 10 znaków/).closest("ul")).toHaveClass(
      "text-[13px]",
    );
    expect(screen.getByRole("button", { name: "Utwórz konto" })).toHaveClass("h-9");
  });
});
