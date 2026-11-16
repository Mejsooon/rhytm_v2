import { redirect } from "next/navigation";

import { Button } from "@/components/controls/button";
import { createClient } from "@/lib/supabase/server";

// Akcja serwerowa: oznacza onboarding jako ukończony i przenosi do aplikacji
async function ukonczOnboarding() {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/logowanie");
  }

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id);

  redirect("/dzis");
}

// Tymczasowy ekran — etap 1 zastąpi go 7 krokami.
// Treść jest statyczna; użytkownika czyta dopiero proxy i akcja, więc strona nie wymaga Suspense.
export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-lg font-medium">Onboarding — etap 1</h1>
      <form action={ukonczOnboarding}>
        <Button type="submit" variant="primary">
          Dalej
        </Button>
      </form>
    </main>
  );
}
