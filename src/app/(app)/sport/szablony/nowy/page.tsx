import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadTemplates } from "@/features/sport/load-sport";
import { TemplateEditor } from "@/features/sport/template-editor";
import { createClient } from "@/lib/supabase/server";

// Dane zależą od ciasteczek → connection + Suspense (jak /sport/trening/[id])
async function NowySzablon() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Profil (format godziny) i ćwiczenia użytkownika do dymka „+ Ćwiczenie”
  const { profile, exercises } = await loadTemplates(supabase, user.id);
  return <TemplateEditor data={{ profile, exercises, template: null }} />;
}

export default function NowySzablonPage() {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <NowySzablon />
    </Suspense>
  );
}
