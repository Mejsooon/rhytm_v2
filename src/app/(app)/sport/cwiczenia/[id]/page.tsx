import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { ExerciseDetail } from "@/features/sport/exercise-detail";
import { loadExercise } from "@/features/sport/load-sport";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ id: string }>;

// Dane zależą od ciasteczek → connection + Suspense (jak /nawyki/[id])
async function Cwiczenie({ params }: { params: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { id } = await params;
  const dane = await loadExercise(supabase, user.id, id);
  // brak ćwiczenia albo cudze → 404
  if (!dane) notFound();

  return <ExerciseDetail data={dane} />;
}

export default function CwiczeniePage({ params }: { params: Parametry }) {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <Cwiczenie params={params} />
    </Suspense>
  );
}
