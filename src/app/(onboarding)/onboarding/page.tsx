import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Wznawianie: przekierowuje na zapisany krok (onboarding_step). Dane zależą od ciasteczek → Suspense.
async function PrzejdzDoKroku(): Promise<never> {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("user_id", user.id)
    .maybeSingle();

  redirect(`/onboarding/${Math.min(profil?.onboarding_step ?? 1, 4)}`);
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <PrzejdzDoKroku />
    </Suspense>
  );
}
