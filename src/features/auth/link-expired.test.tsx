import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => (
    <input type="hidden" name="cf-turnstile-response" value="tok" />
  ),
}));
vi.mock("./actions", () => ({
  resendLink: vi.fn(async () => ({ status: "success" })),
}));

import { resendLink } from "./actions";
import { LinkExpired } from "./link-expired";

describe("LinkExpired", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pokazuje tekst z makiety, a po wysłaniu neutralny komunikat", async () => {
    const user = userEvent.setup();
    render(<LinkExpired type="recovery" />);
    expect(
      screen.getByRole("heading", { name: "Link wygasł" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ten link jest za stary albo został już użyty. Wyślemy nowy na Twój adres.",
      ),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij nowy link" }));

    expect(resendLink).toHaveBeenCalledWith(
      "recovery",
      "ala@przyklad.pl",
      "tok",
    );
    expect(
      await screen.findByText(
        "Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.",
      ),
    ).toBeInTheDocument();
  });

  it("błąd z akcji (Turnstile / e-mail) pokazuje komunikat zamiast sukcesu", async () => {
    vi.mocked(resendLink).mockResolvedValueOnce({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
    const user = userEvent.setup();
    render(<LinkExpired type="signup" />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij nowy link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Potwierdź, że nie jesteś botem",
    );
    expect(
      screen.queryByText(
        "Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.",
      ),
    ).not.toBeInTheDocument();
  });
});
