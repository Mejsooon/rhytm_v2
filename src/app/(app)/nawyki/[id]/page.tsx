import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { HabitDetail } from "@/features/habits/habit-detail";
import { loadHabitDetail } from "@/features/habits/load-habits";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ id: string }>;

// Dane zależą od ciasteczek → connection + Suspense (jak /nawyki)
async function Nawyk({ params }: { params: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { id } = await params;
  const dane = await loadHabitDetail(supabase, user.id, id);
  // Brak nawyku albo cudzy → 404
  if (!dane) notFound();

  return <HabitDetail data={dane} />;
}

export default function NawykPage({ params }: { params: Parametry }) {
  return (
    <Suspense fallback={<ModuleHeader title="Nawyki i sen" />}>
      <Nawyk params={params} />
    </Suspense>
  );
}
