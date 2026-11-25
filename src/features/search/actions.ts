"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { todayIso } from "@/components/controls/calendar-math";
import { expandOccurrences } from "@/features/calendar/occurrences";
import type { BlockRow, ExceptionRow } from "@/features/calendar/occurrences";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { currentStreak } from "@/features/habits/model";
import type { Checks } from "@/features/habits/model";
import { mapHabits } from "@/features/habits/load-habits";
import { rowsLabel } from "@/features/pages/rows-label";
import { formatKm } from "@/features/sport/model";
import { createClient } from "@/lib/supabase/server";
import { formatClockTime, safeTimezone } from "@/lib/time/timezones";

// Wyszukiwanie globalne (ekran /szukaj): strony i wiersze tabel, bloki kalendarza, nawyki, sport.
// Tylko dane zalogowanego użytkownika (RLS + jawny filtr user_id). Sejf: nigdy pola Sekret
// ani wiersze strony systemowej (Hasła) — te wiersze nie są nawet pobierane.

export type SearchItem = { title: string; meta: string; href: string };
export type SearchGroup = {
  title: "Strony" | "Kalendarz" | "Nawyki" | "Sport";
  items: SearchItem[];
};
export type SearchResult =
  | { ok: true; groups: SearchGroup[] }
  | { ok: false; message: string };

const LIMIT = 5;
const MIN_ZNAKOW = 2;
const MAX_ZNAKOW = 80;
// Okno szukania najbliższego wystąpienia bloku i zakres odhaczeń do serii
const DNI_DO_PRZODU = 60;
const DNI_ODHACZEN = 366;
const DNI = ["", "pn", "wt", "śr", "czw", "pt", "sob", "nd"];

const frazaSchema = z.string().trim().max(MAX_ZNAKOW, "Fraza jest za długa.");

export async function searchAll(q: string): Promise<SearchResult> {
  const sprawdzona = frazaSchema.safeParse(q);
  if (!sprawdzona.success) {
    return { ok: false, message: sprawdzona.error.issues[0]?.message ?? "Nieprawidłowa fraza." };
  }
  // PostgREST zamienia `*` w ilike na `%` i nie da się go escapować, więc gwiazdki usuwamy z frazy
  const fraza = sprawdzona.data.replace(/\*/g, "").trim();
  // Za krótka fraza = stan pusty, bez żadnych zapytań
  if (fraza.length < MIN_ZNAKOW) return { ok: true, groups: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Wzorzec ilike: \ % _ są zwykłymi znakami frazy, nie symbolami wieloznacznymi
  const wzorzec = `%${fraza.replace(/[\\%_]/g, (znak) => `\\${znak}`)}%`;

  // Krok 1: równolegle, każde zapytanie z user_id i limitem
  const [profilWynik, stronyWynik, polaWynik, blokiWynik, nawykiWynik, sportWynik] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("timezone, week_start, clock")
        .eq("user_id", user.id)
        .maybeSingle(),
      // Strony (także systemowa — Hasła — ale wyłącznie po tytule i bez licznika wierszy)
      supabase
        .from("pages")
        .select("id, title, is_system, page_blocks(page_rows(count))")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .is("page_blocks.deleted_at", null)
        .is("page_blocks.page_rows.deleted_at", null)
        .ilike("title", wzorzec)
        .order("position", { ascending: true })
        .limit(LIMIT),
      // Pola tytułowe bloków nieusuniętych na stronach nieusuniętych i nie systemowych; nigdy Sekret
      supabase
        .from("page_fields")
        .select(
          "id, block_id, page_blocks!inner(id, page_id, deleted_at, pages!inner(id, title, is_system, deleted_at))",
        )
        .eq("user_id", user.id)
        .eq("is_title", true)
        .neq("type", "secret")
        .is("page_blocks.deleted_at", null)
        .is("page_blocks.pages.deleted_at", null)
        .eq("page_blocks.pages.is_system", false),
      supabase
        .from("blocks")
        .select("*, block_exceptions(*)")
        .eq("user_id", user.id)
        .ilike("title", wzorzec)
        .order("start_local", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("habits")
        .select("*, habit_schedules(*)")
        .eq("user_id", user.id)
        .ilike("name", wzorzec)
        .order("name", { ascending: true })
        .limit(LIMIT),
      supabase
        .from("sport_sessions")
        .select("id, title, type, start_local, runs(distance_km)")
        .eq("user_id", user.id)
        .ilike("title", wzorzec)
        .order("start_local", { ascending: false })
        .limit(LIMIT),
    ]);

  if (stronyWynik.error || polaWynik.error || blokiWynik.error || nawykiWynik.error || sportWynik.error) {
    return { ok: false, message: "Nie udało się wyszukać." };
  }

  const timezone = safeTimezone(profilWynik.data?.timezone);
  const weekStart = profilWynik.data?.week_start === "sun" ? "sun" : "mon";
  const clock = profilWynik.data?.clock === "12" ? "12" : "24";
  const dzis = todayIso(timezone);

  // Krok 2 (zależny od kroku 1): wiersze po polach tytułowych oraz odhaczenia znalezionych nawyków
  // Strona systemowa jest odrzucana jeszcze raz po stronie serwera aplikacji (obrona w głąb)
  const pola = (polaWynik.data ?? []).filter(
    (p) => p.page_blocks && p.page_blocks.pages && !p.page_blocks.pages.is_system,
  );
  const idPolTytulowych = pola.map((p) => p.id);
  const idBlokow = [...new Set(pola.map((p) => p.block_id))];
  const nawykiWiersze = nawykiWynik.data ?? [];
  const idNawykow = nawykiWiersze.map((n) => n.id);

  const [wierszeWynik, odhaczeniaWynik] = await Promise.all([
    idPolTytulowych.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("page_rows")
          // Tylko wartości pól tytułowych (aliasy t0, t1…), nigdy cały `values` wiersza
          .select(["id", "block_id", ...idPolTytulowych.map((id, i) => `t${i}:values->>${id}`)].join(","))
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .in("block_id", idBlokow)
          // Wartość w cudzysłowie (przecinki i nawiasy we frazie nie rozbijają filtra): \ i " poprzedza \
          .or(
            idPolTytulowych
              .map(
                (id) =>
                  `values->>${id}.ilike."${wzorzec.replace(/[\\"]/g, (znak) => `\\${znak}`)}"`,
              )
              .join(","),
          )
          .order("updated_at", { ascending: false })
          .limit(LIMIT),
    idNawykow.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("habit_checks")
          .select("habit_id, date")
          .eq("user_id", user.id)
          .in("habit_id", idNawykow)
          .gte("date", addDays(dzis, -DNI_ODHACZEN))
          .order("date", { ascending: false })
          .limit(1000),
  ]);
  if (wierszeWynik.error || odhaczeniaWynik.error) {
    return { ok: false, message: "Nie udało się wyszukać." };
  }

  const grupy: SearchGroup[] = [];

  // ---------- Strony: tytuły stron, potem wiersze tabel ----------
  const elementyStron: SearchItem[] = [];
  for (const s of stronyWynik.data ?? []) {
    if (s.is_system) {
      elementyStron.push({ title: s.title, meta: "moduł", href: "/hasla" });
      continue;
    }
    const wiersze = (s.page_blocks ?? []).reduce(
      (suma, b) => suma + (b.page_rows ?? []).reduce((n, r) => n + (r.count ?? 0), 0),
      0,
    );
    elementyStron.push({
      title: s.title.trim() === "" ? "Bez tytułu" : s.title,
      meta: wiersze === 0 ? "pusta strona" : rowsLabel(wiersze),
      href: `/strony/${s.id}`,
    });
  }
  for (const w of (wierszeWynik.data ?? []) as unknown as Record<string, unknown>[]) {
    const polaBloku = pola.filter((p) => p.block_id === w.block_id);
    // Tytuł wiersza = pierwsze pole tytułowe bloku z tekstem (alias t<n> = n-te pole tytułowe)
    let tytul = "";
    for (const p of polaBloku) {
      const v = w[`t${idPolTytulowych.indexOf(p.id)}`];
      if (typeof v === "string" && v.trim() !== "") {
        tytul = v;
        break;
      }
    }
    const strona = polaBloku[0]?.page_blocks?.pages;
    if (tytul === "" || !strona) continue;
    elementyStron.push({
      title: tytul,
      meta: `w ${strona.title.trim() === "" ? "Bez tytułu" : strona.title}`,
      href: `/strony/${strona.id}`,
    });
  }
  if (elementyStron.length > 0) {
    grupy.push({ title: "Strony", items: elementyStron.slice(0, LIMIT) });
  }

  // ---------- Kalendarz: najbliższe wystąpienie bloku, a bez przyszłego — ostatnie ----------
  const elementyKalendarza: SearchItem[] = [];
  for (const b of blokiWynik.data ?? []) {
    const { block_exceptions: wyjatki, ...blok } = b;
    const bloki = [blok as BlockRow];
    const wyjatkiBloku = (wyjatki ?? []) as ExceptionRow[];
    const dataStartu = blok.start_local.slice(0, 10);
    let wystapienie = expandOccurrences(bloki, wyjatkiBloku, dzis, addDays(dzis, DNI_DO_PRZODU))[0];
    if (!wystapienie) {
      // Seria zakończona albo blok z przeszłości: ostatnie wystąpienie sprzed dziś
      const od = dataStartu > addDays(dzis, -400) ? dataStartu : addDays(dzis, -400);
      const dawne = expandOccurrences(bloki, wyjatkiBloku, od, addDays(dzis, -1));
      wystapienie = dawne[dawne.length - 1];
    }
    const data = wystapienie?.date ?? dataStartu;
    const start = wystapienie
      ? wystapienie.startMin
      : Number(blok.start_local.slice(11, 13)) * 60 + Number(blok.start_local.slice(14, 16));
    const czasStartu = formatClockTime(Math.floor(start / 60), start % 60, clock);
    // Dziś pokazujemy zakres godzin, w inne dni sam początek
    let czas = czasStartu;
    if (data === dzis && wystapienie) {
      const koniec = (start + wystapienie.durationMin) % 1440;
      czas = `${czasStartu}–${formatClockTime(Math.floor(koniec / 60), koniec % 60, clock)}`;
    }
    const dzien =
      data === dzis ? "dziś" : `${DNI[weekdayOf(data)]} ${data.slice(8, 10)}.${data.slice(5, 7)}`;
    elementyKalendarza.push({
      title: blok.title,
      meta: `${dzien} ${czas}`,
      href: `/kalendarz?widok=dzien&data=${data}`,
    });
  }
  if (elementyKalendarza.length > 0) grupy.push({ title: "Kalendarz", items: elementyKalendarza });

  // ---------- Nawyki: bieżąca seria ----------
  if (nawykiWiersze.length > 0) {
    const harmonogramy = nawykiWiersze.flatMap((n) => n.habit_schedules ?? []);
    const nawyki = mapHabits(nawykiWiersze, harmonogramy);
    const odhaczenia: Checks = new Map();
    for (const o of odhaczeniaWynik.data ?? []) {
      const dni = odhaczenia.get(o.habit_id) ?? new Set<string>();
      dni.add(o.date);
      odhaczenia.set(o.habit_id, dni);
    }
    grupy.push({
      title: "Nawyki",
      items: nawyki.map((n) => {
        const seria = currentStreak(n, odhaczenia, dzis, weekStart);
        const meta =
          seria.unit === "weeks"
            ? `seria ${seria.value} tyg.`
            : `seria ${seria.value} ${seria.value === 1 ? "dzień" : "dni"}`;
        return { title: n.name, meta, href: `/nawyki/${n.id}` };
      }),
    });
  }

  // ---------- Sport: najnowsze sesje ----------
  const elementySportu: SearchItem[] = [];
  for (const s of sportWynik.data ?? []) {
    const data = s.start_local.slice(0, 10);
    const dzien = `${DNI[weekdayOf(data)]} ${data.slice(8, 10)}.${data.slice(5, 7)}`;
    const bieg = s.type === "run";
    const km = Array.isArray(s.runs) ? s.runs[0]?.distance_km : s.runs?.distance_km;
    elementySportu.push({
      title: s.title,
      meta: bieg && typeof km === "number" ? `${dzien} · ${formatKm(km)} km` : dzien,
      href: bieg ? `/sport?miesiac=${data.slice(0, 7)}&bieg=${s.id}` : `/sport/trening/${s.id}`,
    });
  }
  if (elementySportu.length > 0) grupy.push({ title: "Sport", items: elementySportu });

  return { ok: true, groups: grupy };
}
