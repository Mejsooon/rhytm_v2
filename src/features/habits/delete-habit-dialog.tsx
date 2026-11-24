"use client";

// Potwierdzenie usunięcia nawyku (ConfirmDialog); po sukcesie wracamy na listę /nawyki.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/controls";
import type { ActionResult } from "@/lib/action-result";
import { deleteHabit } from "./actions";

export function DeleteHabitDialog({
  habitId,
  name,
  open,
  onOpenChange,
}: {
  habitId: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { push } = useRouter();
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego usunięcia (szybkie dwa kliknięcia)
  const usuwa = useRef(false);

  async function usun() {
    if (usuwa.current) return;
    usuwa.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = await deleteHabit(habitId);
    } catch {
      wynik = { ok: false, message: "Nie udało się usunąć. Spróbuj ponownie." };
    }
    if (!wynik.ok) {
      usuwa.current = false;
      setPending(false);
      setBlad(wynik.message);
      return;
    }
    // Po sukcesie okno zostaje zablokowane aż do przejścia na listę
    push("/nawyki");
  }

  return (
    <ConfirmDialog
      open={open}
      // Esc, tło i „Anuluj” są zablokowane na czas usuwania (pending w ConfirmDialog)
      onOpenChange={onOpenChange}
      title={`Usunąć nawyk „${name}”?`}
      description="Historia odhaczeń i notatki zostaną usunięte."
      error={blad}
      confirmLabel="Usuń"
      pending={pending}
      onConfirm={usun}
    />
  );
}
