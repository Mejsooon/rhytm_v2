import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { HabitsArchive } from "@/features/habits/habits-archive";
import { loadHabitsPage } from "@/features/habits/load-habits";
import { createClient } from "@/lib/supabase/server";

// Zawartość zależy od ciasteczek (profil) → connection + Suspense
async function Archiwum() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  return <HabitsArchive data={await loadHabitsPage(supabase, user.id)} />;
}

export default function ArchiwumPage() {
  return (
    <Suspense>
      <Archiwum />
    </Suspense>
  );
}
