"use server";

// Centrum powiadomień: oznaczanie jako przeczytane. Odczyt idzie przez GET /api/powiadomienia.
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const idsSchema = z.array(z.uuid()).min(1).max(100);

export async function markRead(ids: string[]): Promise<{ ok: boolean }> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("id", parsed.data)
    .is("read_at", null);
  return { ok: !error };
}
