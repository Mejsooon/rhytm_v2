import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { GymView } from "@/features/sport/gym-view";
import { loadWorkout } from "@/features/sport/load-sport";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ id: string }>;

// Dane zależą od ciasteczek → connection + Suspense (jak /nawyki/[id])
async function Trening({ params }: { params: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { id } = await params;
  const dane = await loadWorkout(supabase, user.id, id);
  // Brak treningu, cudzy albo bieg → 404
  if (!dane) notFound();

  return <GymView data={dane} />;
}

export default function TreningPage({ params }: { params: Parametry }) {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <Trening params={params} />
    </Suspense>
  );
}
