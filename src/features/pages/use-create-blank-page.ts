"use client";

// „Nowa strona” (sidebar, telefon): tworzy pustą stronę edytora i przechodzi do /strony/{id};
// błąd pokazuje toast. Kolejne kliknięcia w trakcie tworzenia są ignorowane.
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createBlankPage } from "./actions";
import { BLAD_ZAPISU } from "./messages";

export function useCreateBlankPage() {
  const router = useRouter();
  const tworzenie = useRef(false);

  return async function nowaStrona() {
    if (tworzenie.current) return;
    tworzenie.current = true;
    let wynik: Awaited<ReturnType<typeof createBlankPage>> | null = null;
    try {
      wynik = await createBlankPage();
    } catch {
      wynik = null;
    }
    tworzenie.current = false;
    if (!wynik || !wynik.ok) {
      toast.error(BLAD_ZAPISU);
      return;
    }
    router.push(`/strony/${wynik.id}`);
  };
}
