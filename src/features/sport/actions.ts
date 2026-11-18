"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { IsoDate } from "@/components/controls/calendar-math";
import { todayIso } from "@/components/controls/calendar-math";
import { minutesNow } from "@/features/calendar/load-calendar";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import { EXERCISE_LIBRARY } from "./library";
import {
  RUN_KIND_LABEL,
  runKcal,
  templateSets,
  type GymSetRow,
  type RunKind,
  type TemplateItemRow,
} from "./model";
import {
  difficultySchema,
  exerciseNameSchema,
  gymSessionInputSchema,
  idSchema,
  isoDateSchema,
  runInputSchema,
  setPatchSchema,
  templateInputSchema,
  templateNameSchema,
} from "./schemas";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const BRAK_TRENINGU = "Nie znaleziono treningu.";
const BRAK_SZABLONU = "Nie znaleziono szablonu.";
const BRAK_CWICZENIA = "Nie znaleziono ćwiczenia.";
const BRAK_SERII = "Nie znaleziono serii.";
const ZAJETA_NAZWA = "Masz już ćwiczenie o tej nazwie.";
const DOMYSLNE_POWTORZENIA = "8–10";
const SESJE_HISTORII = 50;
const ROZMIAR_STRONY = 1000;

export type RunInput = {
  id?: string;
  kind: RunKind;
  date: IsoDate;
  start: string; // "HH:MM"
  distanceKm: number | null;
  durationS: number | null;
  difficulty: number | null;
  note: string;
  showInCalendar: boolean;
};

// Jak ActionResult, ale błąd walidacji wskazuje pole formularza biegu
export type RunActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string; field?: keyof RunInput };

export type GymSessionInput = {
  date: IsoDate;
  start: string; // "HH:MM"; przy szablonie godzina pochodzi z szablonu
  templateId?: string;
};

export type SetPatch = {
  weight_kg?: number | null;
  reps?: number | null;
  done?: boolean;
};

export type TemplateInput = {
  id?: string;
  name: string;
  weekdays: number[];
  startTime: string; // "HH:MM"
  items: {
    exerciseName: string;
    setsCount: number;
    repsText: string;
    restS: number;
  }[];
};

const dwie = (n: number) => String(n).padStart(2, "0");

// Strefa i waga z profilu; null przy błędzie zapytania
// (akcja ma wtedy zwrócić błąd, a nie liczyć „dziś” w strefie serwera)
async function profileFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ timezone: string; weightKg: number | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone, weight_kg")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return {
    timezone: safeTimezone(data?.timezone),
    weightKg: data?.weight_kg ?? null,
  };
}

// Id ćwiczeń użytkownika po nazwie bez wielkości liter (klucz: lower(nazwa)).
// Brakujące są tworzone (grupa mięśni z biblioteki); null przy błędzie.
async function exerciseIdsByName(
  supabase: SupabaseClient<Database>,
  userId: string,
  names: string[],
): Promise<Map<string, string> | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("user_id", userId);
  if (error) return null;
  const wynik = new Map<string, string>();
  for (const e of data ?? []) wynik.set(e.name.toLowerCase(), e.id);

  for (const nazwa of names) {
    const klucz = nazwa.toLowerCase();
    if (wynik.has(klucz)) continue;
    const zBiblioteki = EXERCISE_LIBRARY.find(
      (l) => l.name.toLowerCase() === klucz,
    );
    const { data: nowe, error: bladWstawienia } = await supabase
      .from("exercises")
      .insert({
        user_id: userId,
        name: nazwa,
        muscle_group: zBiblioteki?.group ?? null,
      })
      .select("id")
      .single();
    if (nowe) {
      wynik.set(klucz, nowe.id);
      continue;
    }
    // Równoległy zapis utworzył już to ćwiczenie (unikalne lower(name)) — czytamy je,
    // porównując nazwy w JS (bez wzorca ilike, w którym % _ * byłyby symbolami wieloznacznymi)
    if (bladWstawienia?.code !== "23505") return null;
    const { data: ponownie, error: bladPonownie } = await supabase
      .from("exercises")
      .select("id, name")
      .eq("user_id", userId);
    if (bladPonownie) return null;
    const istniejace = (ponownie ?? []).find(
      (e) => e.name.toLowerCase() === klucz,
    );
    if (!istniejace) return null;
    wynik.set(klucz, istniejace.id);
  }
  return wynik;
}

// Widoki, na które wpływa zmiana sesji (kalendarz główny pokazuje podgląd treningów)
function revalidateSport() {
  revalidatePath("/sport");
  revalidatePath("/kalendarz");
}

export async function saveRun(input: RunInput): Promise<RunActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = runInputSchema.safeParse(input);
  if (!parsed.success) {
    const blad = parsed.error.issues[0];
    return {
      ok: false,
      message: blad?.message ?? BLAD_ZAPISU,
      field: blad?.path[0] as keyof RunInput | undefined,
    };
  }
  const dane = parsed.data;
  const profil = await profileFor(supabase, user.id);
  if (!profil) return { ok: false, message: BLAD_ZAPISU };

  // Bieg z czasem jest wykonany (sesja completed = true, żeby listy „wykonanych” nie musiały czytać runs)
  const wykonany = dane.durationS !== null;
  const sesja = {
    title: RUN_KIND_LABEL[dane.kind],
    start_local: `${dane.date}T${dane.start}:00`,
    note: dane.note,
    completed: wykonany,
    show_in_calendar: dane.showInCalendar,
  };

  let sessionId: string;
  // Waga z chwili biegu: przy edycji wykonanego biegu zostaje zapisana wcześniej
  let waga: number | null = null;
  if (dane.id) {
    const { data: zmienione, error } = await supabase
      .from("sport_sessions")
      .update(sesja)
      .eq("id", dane.id)
      .eq("user_id", user.id)
      .eq("type", "run")
      .select("id");
    if (error) return { ok: false, message: BLAD_ZAPISU };
    if (!zmienione || zmienione.length === 0)
      return { ok: false, message: BRAK_TRENINGU };
    sessionId = dane.id;

    const { data: stary, error: bladBiegu } = await supabase
      .from("runs")
      .select("weight_kg_snapshot")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (bladBiegu) return { ok: false, message: BLAD_ZAPISU };
    waga = stary?.weight_kg_snapshot ?? null;
  } else {
    const { data: nowa, error } = await supabase
      .from("sport_sessions")
      .insert({ ...sesja, user_id: user.id, type: "run" })
      .select("id")
      .single();
    if (error || !nowa) return { ok: false, message: BLAD_ZAPISU };
    sessionId = nowa.id;
  }

  if (wykonany && waga === null) waga = profil.weightKg;
  if (!wykonany) waga = null;
  const bieg = {
    session_id: sessionId,
    user_id: user.id,
    kind: dane.kind,
    distance_km: dane.distanceKm,
    duration_s: dane.durationS,
    difficulty: dane.difficulty,
    weight_kg_snapshot: waga,
    // Dystans jest wymagany przy czasie (walidacja), więc tu oba są liczbami
    kcal:
      dane.durationS !== null && dane.distanceKm !== null
        ? runKcal(dane.distanceKm, dane.durationS, waga)
        : null,
  };

  if (dane.id) {
    const { error } = await supabase
      .from("runs")
      .upsert(bieg, { onConflict: "session_id" });
    if (error) return { ok: false, message: BLAD_ZAPISU };
  } else {
    const { error } = await supabase.from("runs").insert(bieg);
    if (error) {
      // Nie zostawiamy sesji biegu bez danych biegu
      await supabase.from("sport_sessions").delete().eq("id", sessionId);
      return { ok: false, message: BLAD_ZAPISU };
    }
  }

  revalidateSport();
  revalidatePath("/dzis");
  return { ok: true, id: sessionId };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };

  // Bieg i serie usuwa kaskada w bazie
  const { data: usuniete, error } = await supabase
    .from("sport_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, template_id, template_date");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!usuniete || usuniete.length === 0)
    return { ok: false, message: BRAK_TRENINGU };

  // Sesja z szablonu: pominięcie dnia, żeby wystąpienie szablonu nie wróciło jako plan
  const usunieta = usuniete[0];
  if (usunieta.template_id && usunieta.template_date) {
    const { error: bladPominiecia } = await supabase
      .from("template_skips")
      .upsert(
        {
          template_id: usunieta.template_id,
          user_id: user.id,
          date: usunieta.template_date,
        },
        { onConflict: "template_id,date", ignoreDuplicates: true },
      );
    if (bladPominiecia) {
      revalidateSport();
      revalidatePath("/dzis");
      return { ok: false, message: BLAD_ZAPISU };
    }
  }

  // Bez /sport/trening/[id]: odświeżona trasa usuniętej sesji dałaby mignięcie 404
  revalidateSport();
  revalidatePath("/dzis");
  return { ok: true };
}

export async function skipTemplateOccurrence(
  templateId: string,
  date: IsoDate,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (
    !idSchema.safeParse(templateId).success ||
    !isoDateSchema.safeParse(date).success
  )
    return { ok: false, message: BLAD_ZAPISU };

  // Ponowne pominięcie tego samego dnia jest po cichu ignorowane; cudzy szablon odrzuca RLS
  const { error } = await supabase
    .from("template_skips")
    .upsert(
      { template_id: templateId, user_id: user.id, date },
      { onConflict: "template_id,date", ignoreDuplicates: true },
    );
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidateSport();
  return { ok: true };
}

// Nowy trening siłowy: pusty albo z szablonu (wystąpienie szablonu w dniu `date`).
// Z szablonu jest idempotentny: druga próba dla tej samej pary (szablon, data) zwraca istniejącą sesję.
export async function createGymSession(
  input: GymSessionInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = gymSessionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }
  const dane = parsed.data;

  // Pusty trening
  if (!dane.templateId) {
    const { data: nowa, error } = await supabase
      .from("sport_sessions")
      .insert({
        user_id: user.id,
        type: "gym",
        title: "Trening siłowy",
        start_local: `${dane.date}T${dane.start}:00`,
        template_id: null,
        template_date: null,
      })
      .select("id")
      .single();
    if (error || !nowa) return { ok: false, message: BLAD_ZAPISU };
    revalidateSport();
    revalidatePath("/dzis");
    return { ok: true, id: nowa.id };
  }

  const profil = await profileFor(supabase, user.id);
  if (!profil) return { ok: false, message: BLAD_ZAPISU };

  const { data: szablon, error: bladSzablonu } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("id", dane.templateId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladSzablonu) return { ok: false, message: BLAD_ZAPISU };
  if (!szablon) return { ok: false, message: BRAK_SZABLONU };

  // Start = godzina szablonu; gdy startujemy dziś już po tej godzinie — teraz
  let start = szablon.start_time.slice(0, 5);
  const dzis = todayIso(profil.timezone);
  const teraz = minutesNow(profil.timezone);
  if (
    dane.date === dzis &&
    teraz > Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5))
  ) {
    start = `${dwie(Math.floor(teraz / 60))}:${dwie(teraz % 60)}`;
  }

  const { data: nowa, error: bladSesji } = await supabase
    .from("sport_sessions")
    .insert({
      user_id: user.id,
      type: "gym",
      title: szablon.name,
      start_local: `${dane.date}T${start}:00`,
      template_id: szablon.id,
      template_date: dane.date,
    })
    .select("id")
    .single();
  if (bladSesji?.code === "23505") {
    // Wystąpienie już rozpoczęte (drugie kliknięcie, druga karta) — zwracamy istniejącą sesję
    const { data: istniejaca, error: bladOdczytu } = await supabase
      .from("sport_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("template_id", szablon.id)
      .eq("template_date", dane.date)
      .maybeSingle();
    if (bladOdczytu || !istniejaca) return { ok: false, message: BLAD_ZAPISU };
    return { ok: true, id: istniejaca.id };
  }
  if (bladSesji || !nowa) return { ok: false, message: BLAD_ZAPISU };

  // Pozycje szablonu i ostatnia wykonana sesja z każdym ćwiczeniem (kg i powt. „jak ostatnio”)
  const { data: pozycje, error: bladPozycji } = await supabase
    .from("workout_template_items")
    .select("*")
    .eq("template_id", szablon.id)
    .eq("user_id", user.id)
    .order("position", { ascending: true });
  let bladHistorii = bladPozycji !== null;
  const ostatnieSerie = new Map<string, GymSetRow[]>();
  const idCwiczen = [...new Set((pozycje ?? []).map((p) => p.exercise_id))];
  if (!bladHistorii && idCwiczen.length > 0) {
    // Ostatnie wykonane treningi siłowe, od najnowszego (ograniczone: ćwiczenie,
    // którego nie było w ostatnich SESJE_HISTORII treningach, startuje bez historii)
    const { data: sesje, error: bladSesjiHistorii } = await supabase
      .from("sport_sessions")
      .select("id, start_local")
      .eq("user_id", user.id)
      .eq("type", "gym")
      .eq("completed", true)
      .order("start_local", { ascending: false })
      .limit(SESJE_HISTORII);
    bladHistorii = bladSesjiHistorii !== null;
    const idSesji = (sesje ?? []).map((s) => s.id);

    // Serie ćwiczeń szablonu z tych treningów, stronami (PostgREST obcina odpowiedź do 1000 wierszy)
    const serie: GymSetRow[] = [];
    if (!bladHistorii && idSesji.length > 0) {
      for (let od = 0; ; od += ROZMIAR_STRONY) {
        const { data, error } = await supabase
          .from("gym_sets")
          .select("*")
          .eq("user_id", user.id)
          .in("session_id", idSesji)
          .in("exercise_id", idCwiczen)
          .order("id", { ascending: true })
          .range(od, od + ROZMIAR_STRONY - 1);
        if (error) {
          bladHistorii = true;
          break;
        }
        serie.push(...((data ?? []) as GymSetRow[]));
        if ((data ?? []).length < ROZMIAR_STRONY) break;
      }
    }

    // Dla każdego ćwiczenia: serie z najnowszej wykonanej sesji, w której wystąpiło
    for (const cwiczenie of idCwiczen) {
      const najnowsza = idSesji.find((id) =>
        serie.some((z) => z.session_id === id && z.exercise_id === cwiczenie),
      );
      if (!najnowsza) continue;
      ostatnieSerie.set(
        cwiczenie,
        serie.filter(
          (z) => z.session_id === najnowsza && z.exercise_id === cwiczenie,
        ),
      );
    }
  }

  const noweSerie = bladHistorii
    ? null
    : templateSets((pozycje ?? []) as TemplateItemRow[], ostatnieSerie);
  let bladSerii = noweSerie === null;
  if (noweSerie && noweSerie.length > 0) {
    const { error } = await supabase.from("gym_sets").insert(
      noweSerie.map((s) => ({
        ...s,
        user_id: user.id,
        session_id: nowa.id,
        done: false,
      })),
    );
    bladSerii = error !== null;
  }
  if (bladSerii) {
    // Bez serii sesja z szablonu byłaby pusta, a drugie „Rozpocznij” już by jej nie uzupełniło
    await supabase.from("sport_sessions").delete().eq("id", nowa.id);
    return { ok: false, message: BLAD_ZAPISU };
  }

  // „ostatnio” na karcie szablonu; błąd tutaj nie cofa treningu
  await supabase
    .from("workout_templates")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", szablon.id)
    .eq("user_id", user.id);

  revalidateSport();
  revalidatePath("/sport/szablony");
  revalidatePath("/dzis");
  return { ok: true, id: nowa.id };
}

// Ćwiczenie do treningu (istniejące po nazwie bez wielkości liter albo nowe) z 3 pustymi seriami.
// Zwraca id ćwiczenia; ćwiczenie już obecne w treningu nie jest dodawane drugi raz.
export async function addExercise(
  sessionId: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsedName = exerciseNameSchema.safeParse(name);
  if (!idSchema.safeParse(sessionId).success)
    return { ok: false, message: BLAD_ZAPISU };
  if (!parsedName.success) {
    return {
      ok: false,
      message: parsedName.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  const { data: sesja, error: bladSesji } = await supabase
    .from("sport_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("type", "gym")
    .maybeSingle();
  if (bladSesji) return { ok: false, message: BLAD_ZAPISU };
  if (!sesja) return { ok: false, message: BRAK_TRENINGU };

  const ids = await exerciseIdsByName(supabase, user.id, [parsedName.data]);
  const exerciseId = ids?.get(parsedName.data.toLowerCase());
  if (!exerciseId) return { ok: false, message: BLAD_ZAPISU };

  const { data: serie, error: bladSerii } = await supabase
    .from("gym_sets")
    .select("exercise_id, exercise_position")
    .eq("session_id", sessionId)
    .eq("user_id", user.id);
  if (bladSerii) return { ok: false, message: BLAD_ZAPISU };
  if ((serie ?? []).some((s) => s.exercise_id === exerciseId))
    return { ok: true, id: exerciseId };

  // Na koniec treningu
  const pozycja =
    Math.max(0, ...(serie ?? []).map((s) => s.exercise_position)) + 1;
  const { error } = await supabase.from("gym_sets").insert(
    [1, 2, 3].map((nr) => ({
      user_id: user.id,
      session_id: sessionId,
      exercise_id: exerciseId,
      exercise_position: pozycja,
      set_no: nr,
      weight_kg: null,
      reps: null,
      done: false,
    })),
  );
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  return { ok: true, id: exerciseId };
}

export async function updateSet(
  id: string,
  patch: SetPatch,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = setPatchSchema.safeParse(patch);
  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }
  // Tylko pola podane w patch (undefined = bez zmiany)
  const zmiany: SetPatch = {};
  if (parsed.data.weight_kg !== undefined)
    zmiany.weight_kg = parsed.data.weight_kg;
  if (parsed.data.reps !== undefined) zmiany.reps = parsed.data.reps;
  if (parsed.data.done !== undefined) zmiany.done = parsed.data.done;
  if (Object.keys(zmiany).length === 0) return { ok: true };

  const { data: zmienione, error } = await supabase
    .from("gym_sets")
    .update(zmiany)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!zmienione || zmienione.length === 0)
    return { ok: false, message: BRAK_SERII };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  return { ok: true };
}

// Nowa seria na końcu ćwiczenia, z ciężarem i powtórzeniami poprzedniej
export async function addSet(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (
    !idSchema.safeParse(sessionId).success ||
    !idSchema.safeParse(exerciseId).success
  )
    return { ok: false, message: BLAD_ZAPISU };

  const { data: serie, error: bladSerii } = await supabase
    .from("gym_sets")
    .select("exercise_position, set_no, weight_kg, reps")
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId)
    .eq("user_id", user.id)
    .order("set_no", { ascending: true });
  if (bladSerii) return { ok: false, message: BLAD_ZAPISU };
  const lista = serie ?? [];
  const poprzednia = lista[lista.length - 1];
  if (!poprzednia) return { ok: false, message: BRAK_CWICZENIA };

  const { data: nowa, error } = await supabase
    .from("gym_sets")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      exercise_id: exerciseId,
      exercise_position: poprzednia.exercise_position,
      set_no: Math.max(...lista.map((s) => s.set_no)) + 1,
      weight_kg: poprzednia.weight_kg,
      reps: poprzednia.reps,
      done: false,
    })
    .select("id")
    .single();
  if (error || !nowa) return { ok: false, message: BLAD_ZAPISU };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  return { ok: true, id: nowa.id };
}

export async function deleteSet(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };

  const { data: usuniete, error } = await supabase
    .from("gym_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!usuniete || usuniete.length === 0)
    return { ok: false, message: BRAK_SERII };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  return { ok: true };
}

export async function removeExercise(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (
    !idSchema.safeParse(sessionId).success ||
    !idSchema.safeParse(exerciseId).success
  )
    return { ok: false, message: BLAD_ZAPISU };

  const { data: usuniete, error } = await supabase
    .from("gym_sets")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!usuniete || usuniete.length === 0)
    return { ok: false, message: BRAK_CWICZENIA };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  return { ok: true };
}

// „Zakończ trening”: wykonany, koniec = teraz w strefie profilu.
// Trudność (1–10) trafia do sport_sessions.difficulty; bez parametru zostaje dotychczasowa.
export async function finishWorkout(
  id: string,
  difficulty?: number | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };
  if (difficulty !== undefined && difficulty !== null) {
    const parsed = difficultySchema.safeParse(difficulty);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
      };
    }
  }

  const profil = await profileFor(supabase, user.id);
  if (!profil) return { ok: false, message: BLAD_ZAPISU };
  const { data: sesja, error: bladSesji } = await supabase
    .from("sport_sessions")
    .select("id, start_local")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("type", "gym")
    .maybeSingle();
  if (bladSesji) return { ok: false, message: BLAD_ZAPISU };
  if (!sesja) return { ok: false, message: BRAK_TRENINGU };

  // Koniec = teraz w strefie profilu. Gdy trening nie jest z dziś albo „teraz” nie wypada po starcie
  // (baza wymaga end_local > start_local), koniec = start + 90 min, jak domyślny czas treningu.
  const dzis = todayIso(profil.timezone);
  const teraz = minutesNow(profil.timezone);
  const start = sesja.start_local.slice(0, 19);
  let koniec = `${dzis}T${dwie(Math.floor(teraz / 60))}:${dwie(teraz % 60)}:00`;
  if (start.slice(0, 10) !== dzis || koniec <= start) {
    koniec = new Date(Date.parse(`${start}Z`) + 90 * 60000)
      .toISOString()
      .slice(0, 19);
  }
  const { data: zmienione, error } = await supabase
    .from("sport_sessions")
    .update({
      completed: true,
      end_local: koniec,
      ...(difficulty !== undefined ? { difficulty } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!zmienione || zmienione.length === 0)
    return { ok: false, message: BRAK_TRENINGU };

  revalidateSport();
  revalidatePath("/sport/trening/[id]", "page");
  revalidatePath("/dzis");
  return { ok: true };
}

export async function saveTemplate(
  input: TemplateInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }
  const dane = parsed.data;

  const ids = await exerciseIdsByName(
    supabase,
    user.id,
    dane.items.map((i) => i.exerciseName),
  );
  if (!ids) return { ok: false, message: BLAD_ZAPISU };

  const pola = {
    name: dane.name,
    weekdays: dane.weekdays,
    start_time: dane.startTime,
  };
  let templateId: string;
  let starePozycje: TemplateItemRow[] = [];
  if (dane.id) {
    const { data: zmienione, error } = await supabase
      .from("workout_templates")
      .update(pola)
      .eq("id", dane.id)
      .eq("user_id", user.id)
      .select("id");
    if (error) return { ok: false, message: BLAD_ZAPISU };
    if (!zmienione || zmienione.length === 0)
      return { ok: false, message: BRAK_SZABLONU };
    templateId = dane.id;

    // Dotychczasowe pozycje — do przywrócenia, gdyby zapis nowych się nie udał
    const { data: stare, error: bladStarych } = await supabase
      .from("workout_template_items")
      .select("*")
      .eq("template_id", templateId)
      .eq("user_id", user.id);
    if (bladStarych) return { ok: false, message: BLAD_ZAPISU };
    starePozycje = stare ?? [];

    // Pozycje zapisujemy od nowa w kolejności z formularza
    const { error: bladUsuniecia } = await supabase
      .from("workout_template_items")
      .delete()
      .eq("template_id", templateId)
      .eq("user_id", user.id);
    if (bladUsuniecia) return { ok: false, message: BLAD_ZAPISU };
  } else {
    const { data: nowy, error } = await supabase
      .from("workout_templates")
      .insert({ ...pola, user_id: user.id })
      .select("id")
      .single();
    if (error || !nowy) return { ok: false, message: BLAD_ZAPISU };
    templateId = nowy.id;
  }

  const { error: bladPozycji } = await supabase
    .from("workout_template_items")
    .insert(
      dane.items.map((i, nr) => ({
        user_id: user.id,
        template_id: templateId,
        exercise_id: ids.get(i.exerciseName.toLowerCase()) as string,
        position: nr + 1,
        sets_count: i.setsCount,
        reps_text: i.repsText,
        rest_s: i.restS,
      })),
    );
  if (bladPozycji) {
    // Nowy szablon bez pozycji nie ma sensu — cofamy go; przy edycji przywracamy stare pozycje
    if (!dane.id)
      await supabase.from("workout_templates").delete().eq("id", templateId);
    else if (starePozycje.length > 0)
      await supabase.from("workout_template_items").insert(starePozycje);
    return { ok: false, message: BLAD_ZAPISU };
  }

  revalidateSport();
  revalidatePath("/sport/szablony");
  revalidatePath("/sport/szablony/[id]", "page");
  return { ok: true, id: templateId };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };

  // Pozycje i pominięcia usuwa kaskada; utworzone sesje zostają (template_id → null)
  const { data: usuniete, error } = await supabase
    .from("workout_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!usuniete || usuniete.length === 0)
    return { ok: false, message: BRAK_SZABLONU };

  revalidateSport();
  revalidatePath("/sport/szablony");
  return { ok: true };
}

// „Zapisz jako szablon”: ćwiczenia w kolejności treningu, liczba serii jak w treningu,
// powtórzenia z pierwszej serii (bez nich „8–10”), przerwa 2:00, godzina startu treningu, bez dni
export async function saveSessionAsTemplate(
  sessionId: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsedName = templateNameSchema.safeParse(name);
  if (!idSchema.safeParse(sessionId).success)
    return { ok: false, message: BLAD_ZAPISU };
  if (!parsedName.success) {
    return {
      ok: false,
      message: parsedName.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  const { data: sesja, error: bladSesji } = await supabase
    .from("sport_sessions")
    .select("id, start_local")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("type", "gym")
    .maybeSingle();
  if (bladSesji) return { ok: false, message: BLAD_ZAPISU };
  if (!sesja) return { ok: false, message: BRAK_TRENINGU };

  const { data: serie, error: bladSerii } = await supabase
    .from("gym_sets")
    .select("exercise_id, exercise_position, set_no, reps")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("exercise_position", { ascending: true })
    .order("set_no", { ascending: true });
  if (bladSerii) return { ok: false, message: BLAD_ZAPISU };
  if (!serie || serie.length === 0)
    return { ok: false, message: "Dodaj przynajmniej jedno ćwiczenie." };

  // Ćwiczenia w kolejności pierwszego wystąpienia (serie są posortowane po pozycji i numerze)
  const pozycje: {
    exercise_id: string;
    sets_count: number;
    reps_text: string;
  }[] = [];
  for (const s of serie) {
    const istniejaca = pozycje.find((p) => p.exercise_id === s.exercise_id);
    if (istniejaca) {
      istniejaca.sets_count = Math.min(10, istniejaca.sets_count + 1);
      continue;
    }
    pozycje.push({
      exercise_id: s.exercise_id,
      sets_count: 1,
      reps_text: s.reps !== null ? String(s.reps) : DOMYSLNE_POWTORZENIA,
    });
  }

  const { data: nowy, error } = await supabase
    .from("workout_templates")
    .insert({
      user_id: user.id,
      name: parsedName.data,
      weekdays: [],
      start_time: sesja.start_local.slice(11, 16),
    })
    .select("id")
    .single();
  if (error || !nowy) return { ok: false, message: BLAD_ZAPISU };

  const { error: bladPozycji } = await supabase
    .from("workout_template_items")
    .insert(
      pozycje.map((p, nr) => ({
        ...p,
        user_id: user.id,
        template_id: nowy.id,
        position: nr + 1,
        rest_s: 120,
      })),
    );
  if (bladPozycji) {
    await supabase.from("workout_templates").delete().eq("id", nowy.id);
    return { ok: false, message: BLAD_ZAPISU };
  }

  revalidatePath("/sport");
  revalidatePath("/sport/szablony");
  return { ok: true, id: nowy.id };
}

export async function renameExercise(
  id: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsedName = exerciseNameSchema.safeParse(name);
  if (!idSchema.safeParse(id).success)
    return { ok: false, message: BLAD_ZAPISU };
  if (!parsedName.success) {
    return {
      ok: false,
      message: parsedName.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  // Unikalność bez wielkości liter pilnuje indeks exercises_user_lower_name
  const { data: zmienione, error } = await supabase
    .from("exercises")
    .update({ name: parsedName.data })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error?.code === "23505") return { ok: false, message: ZAJETA_NAZWA };
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!zmienione || zmienione.length === 0)
    return { ok: false, message: BRAK_CWICZENIA };

  revalidatePath("/sport");
  revalidatePath("/sport/cwiczenia/[id]", "page");
  revalidatePath("/sport/trening/[id]", "page");
  revalidatePath("/sport/szablony");
  return { ok: true };
}
