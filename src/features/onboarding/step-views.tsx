import type { ReactNode } from "react";

import type { OnboardingDraft } from "./model";

export type StepViewProps = {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
};

const TYTULY: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, string> = {
  1: "Uzupełnij profil",
  2: "Kim jesteś?",
  3: "Co chcesz ogarnąć w rhytm?",
  4: "Skąd o nas usłyszałeś?",
  5: "Od czego zaczynasz?",
  6: "Przypomnienia",
  7: "Gotowe",
};

// Na razie tylko nagłówek kroku — prawdziwe widoki dochodzą w Task 6–7.
function Naglowek(step: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
  return function WidokKroku(props: StepViewProps): ReactNode {
    void props;
    return (
      <h1 className="m-0 text-2xl leading-8 font-medium tracking-[-0.01em]">{TYTULY[step]}</h1>
    );
  };
}

// Rejestr widoków kroków: kreator renderuje STEP_VIEWS[step]({ draft, onChange })
export const STEP_VIEWS: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  (props: StepViewProps) => ReactNode
> = {
  1: Naglowek(1),
  2: Naglowek(2),
  3: Naglowek(3),
  4: Naglowek(4),
  5: Naglowek(5),
  6: Naglowek(6),
  7: Naglowek(7),
};
