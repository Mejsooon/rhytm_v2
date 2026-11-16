import { OnboardingForm } from "@/features/onboarding/onboarding-form";

// Tymczasowy ekran — etap 1 zastąpi go 7 krokami.
// Treść jest statyczna; użytkownika czyta dopiero proxy i akcja, więc strona nie wymaga Suspense.
export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-lg font-medium">Onboarding — etap 1</h1>
      <OnboardingForm />
    </main>
  );
}
