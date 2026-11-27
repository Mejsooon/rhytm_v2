"use client";

// Błąd poza aplikacją albo w samej powłoce: ten sam ekran bez paska bocznego
import { ServerError } from "@/components/errors/server-error";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-white text-foreground">
      <ServerError error={error} retry={retry} />
    </main>
  );
}
