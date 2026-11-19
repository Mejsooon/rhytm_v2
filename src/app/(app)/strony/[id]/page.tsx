import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorView } from "@/features/pages/editor/editor-view";
import { loadPage } from "@/features/pages/load-page";
import { TemplatePageView } from "@/features/pages/table/template-page-view";

async function Strona({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const dane = await loadPage(id);
  if (!dane) notFound();

  // Strona z szablonu: tabela z kartami; reszta to edytor bloków
  if (dane.page.templateKey !== null) return <TemplatePageView data={dane} />;
  return <EditorView data={dane} />;
}

export default function StronaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Strona params={params} />
    </Suspense>
  );
}
