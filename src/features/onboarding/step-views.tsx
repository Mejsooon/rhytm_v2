import type { ReactNode } from "react";

import type { OnboardingDraft } from "./model";
import { StepDone } from "./steps/step-done";
import { StepGoals } from "./steps/step-goals";
import { StepNotify } from "./steps/step-notify";
import { StepPages } from "./steps/step-pages";
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

// Rejestr widoków kroków: kreator renderuje <STEP_VIEWS[step] {...props} /> jako komponent (widoki mogą używać hooków)
export const STEP_VIEWS: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7,
  (props: StepViewProps) => ReactNode
> = {
  1: StepProfile,
  2: StepRoles,
  3: StepGoals,
  4: StepSource,
  5: StepPages,
  6: StepNotify,
  7: StepDone,
};
