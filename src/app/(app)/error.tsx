"use client";

// Błąd ekranu aplikacji: pasek boczny z layoutu zostaje
import { ServerError } from "@/components/errors/server-error";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ServerError error={error} retry={retry} />;
}
