import { describe, expect, it } from "vitest";
import { PALETA } from "./fields";
import { buildTemplateBlocks, NEW_TABLE_BLOCK, PENDING_TO_TEMPLATE, TEMPLATES } from "./templates";
import type { TableSettings } from "./table-model";
import { parsePageIcon } from "./page-icons";

function seqId() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("ikony szablonów", () => {
  it("books 📚, projects rakieta niebieska, websites glob morski, pusta bez ikony; wszystkie parsują się", () => {
    expect(TEMPLATES.books.icon).toBe("📚");
    expect(TEMPLATES.projects.icon).toBe("lucide:rocket:blue");
    expect(TEMPLATES.websites.icon).toBe("lucide:globe:teal");
    expect(TEMPLATES.empty.icon).toBe("");
    for (const klucz of ["books", "projects", "websites"] as const) {
      expect(parsePageIcon(TEMPLATES[klucz].icon)).not.toBeNull();
    }
  });
});

describe("buildTemplateBlocks", () => {
  it("opcje domyślne nowego wiersza z makiet wskazują id opcji", () => {
    const domyslne = (key: "books" | "projects" | "websites") => {
      const [blok] = buildTemplateBlocks(key, seqId());
      return blok.fields
        .filter((f) => f.config.default_option !== undefined)
        .map((f) => [f.name, f.config.options?.find((o) => o.id === f.config.default_option)?.label]);
    };
    expect(domyslne("books")).toEqual([["Status", "Chcę przeczytać"]]);
    expect(domyslne("projects")).toEqual([
      ["Status", "Do zrobienia"],
      ["Obszar", "Własne"],
    ]);
    expect(domyslne("websites")).toEqual([
      ["Status", "Wycena"],
      ["Hosting", "Framer"],
    ]);
  });

  it("books: pola z typami, is_title tylko na Tytule", () => {
    const [blok] = buildTemplateBlocks("books", seqId());
    expect(blok.type).toBe("table");
    expect(blok.fields.map((f) => [f.name, f.type, f.is_title])).toEqual([
      ["Tytuł", "text", true],
      ["Autor", "text", false],
      ["Status", "status", false],
      ["Ocena", "rating", false],
      ["Przeczytana", "date", false],
    ]);
    expect(blok.fields[2].config.options?.map((o) => [o.label, o.color])).toEqual([
      ["Czytam", "#0070f3"],
      ["Przeczytane", "#15803d"],
      ["Chcę przeczytać", "#525252"],
    ]);
    expect(blok.rows).toEqual([]);
  });

  it.each(["empty", "books", "projects", "websites"] as const)(
    "%s: id w ustawieniach wskazują pola i opcje z bloku",
    (key) => {
      const [blok] = buildTemplateBlocks(key, seqId());
      const settings = blok.content.settings as TableSettings;
      const polaId = new Set(blok.fields.map((f) => f.id));
      const opcjeId = new Set(blok.fields.flatMap((f) => f.config.options?.map((o) => o.id) ?? []));
      for (const s of settings.sort) expect(polaId.has(s.field_id)).toBe(true);
      for (const [id, sm] of Object.entries(settings.column_summaries)) {
        expect(polaId.has(id)).toBe(true);
        if (sm.option_id) expect(opcjeId.has(sm.option_id)).toBe(true);
        if (sm.where) {
          expect(polaId.has(sm.where.field_id)).toBe(true);
          expect(opcjeId.has(sm.where.option_id)).toBe(true);
        }
      }
      for (const c of settings.pinned_cards) {
        expect(polaId.has(c.field_id)).toBe(true);
        if (c.date_field_id) expect(polaId.has(c.date_field_id)).toBe(true);
        if (c.title_field_id) expect(polaId.has(c.title_field_id)).toBe(true);
        if (c.option_id) expect(opcjeId.has(c.option_id)).toBe(true);
        if (c.done_option_id) expect(opcjeId.has(c.done_option_id)).toBe(true);
      }
      // Id bloku, pól i opcji są unikalne
      const wszystkie = [blok.id, ...polaId, ...opcjeId];
      expect(new Set(wszystkie).size).toBe(wszystkie.length);
    },
  );

  it("books: sort status, data (malejąco) i karty z szablonu", () => {
    const [blok] = buildTemplateBlocks("books", seqId());
    const settings = blok.content.settings as TableSettings;
    expect(settings.sort.map((s) => [blok.fields.find((f) => f.id === s.field_id)?.name, s.dir])).toEqual([
      ["Status", "asc"],
      ["Przeczytana", "desc"],
    ]);
    expect(settings.pinned_cards.map((c) => c.label)).toEqual([
      "Przeczytane w {year}",
      "Czytam teraz",
      "Średnia ocena",
    ]);
  });

  it("projects: Termin w kalendarzu, Obszar jako select, empty_label „Bez nazwy”", () => {
    const [blok] = buildTemplateBlocks("projects", seqId());
    expect(blok.fields.map((f) => f.name)).toEqual(["Nazwa", "Status", "Obszar", "Termin", "Repo"]);
    expect(blok.fields.find((f) => f.name === "Termin")?.config.show_in_calendar).toBe(true);
    expect(blok.fields.find((f) => f.name === "Obszar")?.type).toBe("select");
    expect(blok.fields[0].config.empty_label).toBe("Bez nazwy");
    expect(blok.fields.find((f) => f.name === "Status")?.config.options?.map((o) => o.color)).toEqual([
      "#0070f3",
      "#525252",
      "#c2410c",
      "#15803d",
    ]);
  });

  it("websites: Hosting, empty_label „Bez nazwy”", () => {
    const [blok] = buildTemplateBlocks("websites", seqId());
    expect(blok.fields.map((f) => f.name)).toEqual(["Nazwa", "URL", "Klient", "Status", "Hosting"]);
    expect(blok.fields[0].config.empty_label).toBe("Bez nazwy");
    expect(blok.fields.find((f) => f.name === "Status")?.config.options?.map((o) => o.label)).toEqual([
      "Na żywo",
      "W budowie",
      "Wycena",
      "Wstrzymana",
    ]);
  });

  it("empty: tylko tytułowe pole Nazwa, bez nazwy tabeli", () => {
    const [blok] = buildTemplateBlocks("empty", seqId());
    expect(blok.fields).toHaveLength(1);
    expect(blok.fields[0]).toMatchObject({ name: "Nazwa", type: "text", is_title: true });
    expect(blok.content.name).toBe("");
  });

  it("kolory opcji mieszczą się w palecie 8 kolorów", () => {
    for (const key of ["books", "projects", "websites"] as const) {
      for (const f of buildTemplateBlocks(key, seqId())[0].fields) {
        for (const o of f.config.options ?? []) expect(PALETA).toContain(o.color);
      }
    }
  });
});

describe("NEW_TABLE_BLOCK", () => {
  it("Nazwa, Status (3 opcje), Data i dwa puste wiersze", () => {
    const blok = NEW_TABLE_BLOCK(seqId());
    expect(blok.fields.map((f) => [f.name, f.type, f.is_title])).toEqual([
      ["Nazwa", "text", true],
      ["Status", "status", false],
      ["Data", "date", false],
    ]);
    expect(blok.fields[1].config.options?.map((o) => o.label)).toEqual(["Do zrobienia", "W toku", "Zrobione"]);
    expect(blok.rows).toEqual([{ values: {} }, { values: {} }]);
  });
});

describe("TEMPLATES i PENDING_TO_TEMPLATE", () => {
  it("teksty z NewPage", () => {
    expect(TEMPLATES.empty.name).toBe("Pusta strona");
    expect(TEMPLATES.books.desc).toBe("Status czytania, ocena, licznik przeczytanych.");
    expect(TEMPLATES.projects.extra).toBe("↻ Terminy trafią do kalendarza głównego.");
  });

  it("mapuje nazwy z onboardingu", () => {
    expect(PENDING_TO_TEMPLATE).toEqual({
      Books: "books",
      Projects: "projects",
      Websites: "websites",
      Passwords: "passwords",
    });
  });
});

describe("szablon passwords", () => {
  it("szablon passwords ma Serwis/Login/Hasło(secret)/URL", () => {
    expect(TEMPLATES.passwords.name).toBe("Passwords");
    expect(TEMPLATES.passwords.icon).toBe("🔒");
    const [blok] = buildTemplateBlocks("passwords", (() => {
      let n = 0;
      return () => `id-${++n}`;
    })());
    expect(blok.fields.map((f) => [f.name, f.type, f.is_title])).toEqual([
      ["Serwis", "text", true],
      ["Login", "text", false],
      ["Hasło", "secret", false],
      ["URL", "url", false],
    ]);
    expect(blok.fields[0].config.empty_label).toBe("Bez nazwy");
    const ustawienia = blok.content.settings as { pinned_cards: unknown[]; column_summaries: object };
    expect(ustawienia.pinned_cards).toEqual([]);
    expect(ustawienia.column_summaries).toEqual({});
  });
});
