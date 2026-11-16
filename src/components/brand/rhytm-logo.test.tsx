import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RhytmLogo } from "./rhytm-logo";

describe("RhytmLogo", () => {
  it("rysuje 9 kwadratów, w tym dokładnie jeden akcentowy", () => {
    const { container } = render(<RhytmLogo />);
    expect(container.querySelectorAll("rect")).toHaveLength(9);
    expect(container.querySelectorAll('rect[fill="#15803d"]')).toHaveLength(1);
  });

  it("z withWordmark pokazuje napis rhytm", () => {
    render(<RhytmLogo withWordmark />);
    expect(screen.getByText("rhytm")).toBeInTheDocument();
  });

  it("bez withWordmark nie ma napisu", () => {
    render(<RhytmLogo />);
    expect(screen.queryByText("rhytm")).not.toBeInTheDocument();
  });
});
