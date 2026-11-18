import { describe, expect, it } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";
import { loadToday } from "./load-today";

type Wynik = Parameters<typeof fakeTable>[0] & { count?: number };

// Atrapa klienta: każde `from(tabela)` tworzy nowe zapytanie (kolejne wywołania tej samej
// tabeli dostają kolejne wyniki z listy), a wszystkie zapytania są zapamiętane do asercji.
function klient(tabele: Record<string, Wynik[]>) {
  const zapytania: { tabela: string; q: ReturnType<typeof fakeTable> }[] = [];
  const licznik: Record<string, number> = {};
  const supabase = {
    from: (tabela: string) => {
      const i = licznik[tabela] ?? 0;
      licznik[tabela] = i + 1;
      const lista = tabele[tabela] ?? [];
      const wynik = lista[Math.min(i, lista.length - 1)] ?? { data: [] };
      const q = fakeTable(wynik as never);
      zapytania.push({ tabela, q });
      return q;
    },
  } as never;
  return { supabase, zapytania };
}

const PROFIL = {
  single: {
    timezone: "Europe/Warsaw",
    week_start: "mon",
    clock: "24",
    display_name: "Mejson",
    avatar_path: null,
    sleep_goal_min: 450,
    km_goal_on: true,
    weekly_km_goal: 30,
    workouts_goal_on: true,
    weekly_workouts_goal: 3,
    created_at: "2026-10-01T10:00:00Z",
  },
};

// Czwartek 19.11.2026, 11:30 w Warszawie
const TERAZ = new Date("2026-11-19T10:30:00Z");

const zadanie = (o: Record<string, unknown>) => ({
  id: "t",
  user_id: "u1",
  title: "z",
  done: false,
  due_date: null,
  block_id: null,
  occurrence_date: null,
  position: 0,
  ...o,
});

const sesja = (o: Record<string, unknown>) => ({
  id: "s1",
  user_id: "u1",
  type: "gym",
  title: "Push",
  start_local: "2026-11-18T18:00:00",
  end_local: null,
  completed: true,
  show_in_calendar: true,
  template_id: null,
  template_date: null,
  note: null,
  difficulty: null,
  created_at: null,
  ...o,
});

describe("loadToday", () => {
  it("składa profil, dziś, teraz i początek tygodnia wg week_start", async () => {
    const { supabase } = klient({ profiles: [PROFIL] });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.today).toBe("2026-11-19");
    expect(wynik.nowMin).toBe(11 * 60 + 30);
    expect(wynik.weekStartDate).toBe("2026-11-16");
    expect(wynik.profile).toEqual({
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      displayName: "Mejson",
      avatarPath: null,
      sleepGoalMin: 450,
      kmGoalOn: true,
      weeklyKmGoal: 30,
      workoutsGoalOn: true,
      weeklyWorkoutsGoal: 3,
      createdAt: "2026-10-01T10:00:00Z",
    });
  });

  it("tydzień od niedzieli, gdy week_start = sun", async () => {
    const { supabase } = klient({
      profiles: [{ single: { ...PROFIL.single, week_start: "sun" } }],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.weekStartDate).toBe("2026-11-15");
  });

  it("zakresy zapytań to tydzień (pn–nd), a każde zapytanie jest filtrowane user_id", async () => {
    const { supabase, zapytania } = klient({ profiles: [PROFIL] });
    await loadToday(supabase, "u1", TERAZ);

    for (const { tabela, q } of zapytania) {
      expect(q.eq, `tabela ${tabela}`).toHaveBeenCalledWith("user_id", "u1");
    }

    const odhaczenia = zapytania.find((z) => z.tabela === "habit_checks")!.q;
    expect(odhaczenia.gte).toHaveBeenCalledWith("date", "2026-11-16");
    expect(odhaczenia.lte).toHaveBeenCalledWith("date", "2026-11-22");
    const sen = zapytania.find((z) => z.tabela === "sleep_logs")!.q;
    expect(sen.gte).toHaveBeenCalledWith("date", "2026-11-16");
    expect(sen.lte).toHaveBeenCalledWith("date", "2026-11-22");
    const blokiTydzien = zapytania.filter((z) => z.tabela === "blocks")[0].q;
    expect(blokiTydzien.lte).toHaveBeenCalledWith(
      "start_local",
      "2026-11-22T23:59:59",
    );
  });

  it("zadania: tydzień ∪ zaległe niezrobione ∪ bez daty, bez duplikatów", async () => {
    const { supabase, zapytania } = klient({
      profiles: [PROFIL],
      tasks: [
        {
          data: [
            zadanie({ id: "t-tydz", due_date: "2026-11-18" }),
            zadanie({ id: "t-dubel", due_date: "2026-11-19" }),
          ],
        },
        {
          data: [
            zadanie({ id: "t-dubel", due_date: "2026-11-19" }),
            zadanie({ id: "t-zalegle", due_date: "2026-11-10" }),
            zadanie({ id: "t-bez", due_date: null }),
          ],
        },
      ],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.tasks.map((t) => t.id).sort()).toEqual([
      "t-bez",
      "t-dubel",
      "t-tydz",
      "t-zalegle",
    ]);
    // Drugie zapytanie o zadania: zaległe (przed tygodniem, niezrobione) lub bez terminu
    const drugie = zapytania.filter((z) => z.tabela === "tasks")[1].q;
    expect(drugie.or).toHaveBeenCalledWith(
      "and(due_date.lt.2026-11-16,done.eq.false),due_date.is.null",
    );
  });

  it("nawyki z odhaczeniami tygodnia zamienione na mapę, sen z tygodnia", async () => {
    const { supabase } = klient({
      profiles: [PROFIL],
      habits: [
        {
          data: [
            {
              id: "h1",
              name: "Czytanie",
              remind_at: null,
              show_on_today: true,
              created_at: "2026-10-01T10:00:00Z",
            },
          ],
        },
      ],
      habit_schedules: [
        {
          data: [
            {
              habit_id: "h1",
              valid_from: "2026-10-01",
              schedule_type: "daily",
              weekdays: [],
              times_per_week: null,
            },
          ],
        },
      ],
      habit_checks: [
        {
          data: [
            { habit_id: "h1", date: "2026-11-17" },
            { habit_id: "h1", date: "2026-11-18" },
          ],
        },
      ],
      sleep_logs: [
        {
          data: [
            {
              date: "2026-11-19",
              slept_at: "23:00:00",
              woke_at: "07:00:00",
              feeling: 4,
              tags: null,
              note: null,
            },
          ],
        },
      ],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.habits).toHaveLength(1);
    expect(wynik.habits[0].schedules[0].type).toBe("daily");
    expect([...(wynik.checks.get("h1") ?? [])]).toEqual([
      "2026-11-17",
      "2026-11-18",
    ]);
    expect(wynik.sleepLogs).toEqual([
      {
        date: "2026-11-19",
        sleptAt: "23:00",
        wokeAt: "07:00",
        feeling: 4,
        tags: [],
        note: null,
      },
    ]);
  });

  it("sport: na Dziś liczymy też treningi ukryte w kalendarzu", async () => {
    const { supabase } = klient({
      profiles: [PROFIL],
      sport_sessions: [
        {
          data: [
            sesja({ id: "widoczna" }),
            sesja({ id: "ukryta", show_in_calendar: false }),
          ],
        },
      ],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.sportItems.map((i) => i.key)).toEqual([
      "s:widoczna",
      "s:ukryta",
    ]);
  });

  it("wystąpienia bloków z dziś i kategorie", async () => {
    const { supabase } = klient({
      profiles: [PROFIL],
      blocks: [
        {
          data: [
            {
              id: "b1",
              user_id: "u1",
              title: "Uczelnia",
              start_local: "2026-11-19T09:00:00",
              duration_min: 60,
              category_id: "c1",
              note: null,
              recurrence: null,
              remind: false,
              timezone: "Europe/Warsaw",
              created_at: null,
              updated_at: null,
            },
          ],
        },
      ],
      categories: [{ data: [{ id: "c1", name: "Studia", color: "#123456" }] }],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.occurrencesToday.map((o) => o.blockId)).toEqual(["b1"]);
    expect(wynik.categories.map((k) => k.id)).toEqual(["c1"]);
  });

  it("liczniki z całej historii: bloki, nawyki, treningi, wpisy snu", async () => {
    const { supabase, zapytania } = klient({
      profiles: [PROFIL],
      blocks: [{ data: [] }, { count: 3 }],
      habits: [{ data: [] }, { count: 2 }],
      sport_sessions: [{ data: [] }, { count: 5 }],
      sleep_logs: [{ data: [] }, { count: 7 }],
    });
    const wynik = await loadToday(supabase, "u1", TERAZ);
    expect(wynik.counts).toEqual({
      blocks: 3,
      habits: 2,
      workouts: 5,
      sleepLogs: 7,
    });
    const licznikBlokow = zapytania.filter((z) => z.tabela === "blocks")[1].q;
    expect(licznikBlokow.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
  });

  it("błąd zapytania rzuca wyjątek", async () => {
    const { supabase } = klient({
      profiles: [PROFIL],
      habits: [{ error: { message: "boom" } }],
    });
    await expect(loadToday(supabase, "u1", TERAZ)).rejects.toThrow("boom");
  });
});
