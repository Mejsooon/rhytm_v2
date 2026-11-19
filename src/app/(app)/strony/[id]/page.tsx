import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { EditorView } from "@/features/pages/editor/editor-view";
import { loadPage } from "@/features/pages/load-page";

async function Strona({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const dane = await loadPage(id);
  if (!dane) notFound();

  // Strona z szablonu: tymczasowo sam nagłówek (Task 8 podstawia TemplatePageView)
  if (dane.page.templateKey !== null) {
    return (
      <ModuleHeader
        title={dane.page.title.trim() === "" ? "Bez tytułu" : dane.page.title}
        webParent="Strony"
        phoneLabel="Strony"
      />
    );
  }
  return <EditorView data={dane} />;
}

export default function StronaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Strona params={params} />
    </Suspense>
  );
}
