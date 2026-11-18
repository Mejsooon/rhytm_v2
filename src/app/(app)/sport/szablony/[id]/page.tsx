import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadTemplate } from "@/features/sport/load-sport";
import { TemplateEditor } from "@/features/sport/template-editor";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ id: string }>;

// Dane zależą od ciasteczek → connection + Suspense (jak /sport/trening/[id])
async function EdycjaSzablonu({ params }: { params: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { id } = await params;
  const dane = await loadTemplate(supabase, user.id, id);
  // Brak szablonu, cudzy albo zły id → 404
  if (!dane) notFound();

  return (
    <TemplateEditor
      data={{
        profile: dane.profile,
        exercises: dane.exercises,
        template: dane.template,
      }}
    />
  );
}

export default function EdycjaSzablonuPage({ params }: { params: Parametry }) {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <EdycjaSzablonu params={params} />
    </Suspense>
  );
}
