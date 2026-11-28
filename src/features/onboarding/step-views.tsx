import type { ReactNode } from "react";

import type { OnboardingDraft, Step } from "./model";
import { StepFirstDay } from "./steps/step-first-day";
import { StepProfile } from "./steps/step-profile";
import { StepReminders } from "./steps/step-reminders";
import { StepUses } from "./steps/step-uses";

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
export const STEP_VIEWS: Record<Step, (props: StepViewProps) => ReactNode> = {
  1: StepProfile,
  2: StepUses,
  3: StepFirstDay,
  4: StepReminders,
};
