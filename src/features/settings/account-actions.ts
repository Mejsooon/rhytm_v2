"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AccountResult = { ok: true } | { ok: false; message: string };

// Adres zawsze przycinany i zapisywany małymi literami
const adresSchema = z.string().trim().toLowerCase().pipe(z.email());

// Zmiana e-maila: Supabase wysyła link na obecny i na nowy adres (double_confirm_changes), zmiana wchodzi po obu kliknięciach
export async function requestEmailChange(
  email: string,
): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = adresSchema.safeParse(email);
  if (!parsed.success)
    return { ok: false, message: "To nie wygląda na adres e-mail." };
  if (parsed.data === (user.email ?? "").toLowerCase())
    return { ok: false, message: "To już jest Twój adres." };

  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) {
    const kod = error.code ?? "";
    if (kod === "email_exists")
      return { ok: false, message: "Ten adres jest już zajęty." };
    if (error.status === 429 || kod.includes("rate_limit"))
      return { ok: false, message: "Za dużo prób. Spróbuj za chwilę." };
    return {
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    };
  }

  revalidatePath("/ustawienia/ogolne");
  return { ok: true };
}
