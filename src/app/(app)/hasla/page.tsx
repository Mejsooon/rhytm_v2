import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadPasswordsModule } from "@/features/passwords/load-passwords";
import { PasswordsView } from "@/features/passwords/passwords-view";

// Dane zależą od ciasteczek (i tworzą stronę systemową przy pierwszym wejściu) → connection + Suspense (jak /kalendarz)
async function Hasla() {
  await connection();
  const dane = await loadPasswordsModule();
  if (!dane) notFound();
  return <PasswordsView data={dane} />;
}

export default function HaslaPage() {
  return (
    <Suspense fallback={<ModuleHeader title="Hasła" webParent="Moduły" />}>
      <Hasla />
    </Suspense>
  );
}
