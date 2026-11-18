"use client";

// Potwierdzenie usunięcia nawyku; po sukcesie wracamy na listę /nawyki.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, FormDialog } from "@/components/controls";
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
    <FormDialog
      open={open}
      // Esc, tło i ✕ są zablokowane na czas usuwania
      onOpenChange={(otwarte) => {
        if (!otwarte && pending) return;
        onOpenChange(otwarte);
      }}
      title={`Usunąć nawyk „${name}”?`}
      footer={
        <>
          {blad && (
            <p role="alert" className="mr-auto text-xs text-[#b91c1c]">
              {blad}
            </p>
          )}
          <Button disabled={pending} onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void usun()}>
            Usuń
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] text-[#666666]">Historia odhaczeń i notatki zostaną usunięte.</p>
    </FormDialog>
  );
}
