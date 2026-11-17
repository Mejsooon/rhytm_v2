import type { ReactNode } from "react";

import type { OnboardingDraft } from "./model";
import { StepGoals } from "./steps/step-goals";
import { StepProfile } from "./steps/step-profile";
import { StepRoles } from "./steps/step-roles";
import { StepSource } from "./steps/step-source";

export type StepViewProps = {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
  userId: string;
  // Adres podglądu zdjęcia (lokalny object URL po udanym uploadzie albo adres z serwera)
  avatarUrl: string | null;
  // Wołane po udanym uploadzie — kreator tworzy z pliku podgląd
  onAvatarFile: (file: File) => void;
  // true, gdy użytkownik nie zapisał jeszcze kroku 1 (wtedy bierzemy strefę z przeglądarki)
  firstVisit: boolean;
  now: Date;
};

const TYTULY: Record<5 | 6 | 7, string> = {
  5: "Od czego zaczynasz?",
  6: "Przypomnienia",
  7: "Gotowe",
};

// Na razie tylko nagłówek kroku — prawdziwe widoki 5–7 dochodzą w Task 7.
function Naglowek(step: 5 | 6 | 7) {
  return function WidokKroku(props: StepViewProps): ReactNode {
    void props;
    return (
      <h1 className="m-0 text-2xl leading-8 font-medium tracking-[-0.01em]">{TYTULY[step]}</h1>
    );
  };
}

// Rejestr widoków kroków: kreator renderuje <STEP_VIEWS[step] {...props} /> jako komponent (widoki mogą używać hooków)
export const STEP_VIEWS: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  (props: StepViewProps) => ReactNode
> = {
  1: StepProfile,
  2: StepRoles,
  3: StepGoals,
  4: StepSource,
  5: Naglowek(5),
  6: Naglowek(6),
  7: Naglowek(7),
};
