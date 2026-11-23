import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorView } from "@/features/pages/editor/editor-view";
import { loadPage } from "@/features/pages/load-page";
import { loadPages } from "@/features/pages/load-pages";
import { TemplatePageView } from "@/features/pages/table/template-page-view";

async function Strona({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  // Lista stron (dla menu strony na telefonie) — loadPages jest w cache() razem z layoutem
  const [dane, strony] = await Promise.all([loadPage(id), loadPages()]);
  if (!dane) notFound();

  // Hasła (tabela z Sekretem i sejfem) zostają w widoku szablonu; każda inna strona to edytor bloków
  if (dane.page.templateKey === "passwords") return <TemplatePageView data={dane} pages={strony} />;
  return <EditorView data={dane} pages={strony} />;
}

export default function StronaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Strona params={params} />
    </Suspense>
  );
}
