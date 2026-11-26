import { describe, expect, it } from "vitest";
import { PALETA } from "./fields";
import {
  buildTemplateBlocks,
  LEGACY_TEMPLATE_TITLES,
  NEW_TABLE_BLOCK,
  PENDING_TO_TEMPLATE,
  TEMPLATE_KEYS,
  TEMPLATES,
  templateDefaults,
  templateSummaries,
  templateViews,
} from "./templates";
import type { PageField } from "./fields";
import type { TableSettings } from "./table-model";
import { parsePageIcon } from "./page-icons";

function seqId() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("ikony szablonów", () => {
  it("ikony w formacie lucide:<nazwa>, wszystkie parsują się do nazwy Lucide", () => {
    expect(TEMPLATES.empty.icon).toBe("lucide:table");
    expect(TEMPLATES.books.icon).toBe("lucide:book-open");
    expect(TEMPLATES.projects.icon).toBe("lucide:rocket");
    expect(TEMPLATES.websites.icon).toBe("lucide:globe");
    for (const klucz of TEMPLATE_KEYS) {
      expect(parsePageIcon(TEMPLATES[klucz].icon)).not.toBeNull();
    }
  });
});

describe("blok startowy z opisem", () => {
  it("books: [0] to tekst z intro, [1] to tabela z polami, kartami i stopką", () => {
    const bloki = buildTemplateBlocks("books", seqId());
    expect(bloki).toHaveLength(2);
    expect(bloki[0]).toMatchObject({
      type: "text",
      content: { text: "Co czytam, co przeczytałem i co chcę przeczytać." },
      fields: [],
      rows: [],
    });
    expect(bloki[1].type).toBe("table");
    expect(bloki[1].fields).toHaveLength(5);
    const settings = bloki[1].content.settings as TableSettings;
    expect(settings.pinned_cards).toHaveLength(3);
    expect(Object.keys(settings.column_summaries)).toHaveLength(3);
  });

  it("projects i websites: intro z makiet", () => {
    expect(buildTemplateBlocks("projects", seqId())[0].content).toEqual({
      text: "Projekty na studia, własne i dla klientów.",
    });
    expect(buildTemplateBlocks("websites", seqId())[0].content).toEqual({
      text: "Strony klientów: URL, klient, status.",
    });
  });

  it("empty: strona bez żadnych bloków (decyzja po kroku 2 — szybki start w edytorze)", () => {
    expect(TEMPLATES.empty.intro).toBe("");
    expect(buildTemplateBlocks("empty", seqId())).toEqual([]);
  });
});

describe("buildTemplateBlocks", () => {
  it("opcje domyślne nowego wiersza z makiet wskazują id opcji", () => {
    const domyslne = (key: "books" | "projects" | "websites") => {
      const blok = buildTemplateBlocks(key, seqId()).find((b) => b.type === "table")!;
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
    const blok = buildTemplateBlocks("books", seqId()).find((b) => b.type === "table")!;
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

  it.each(["books", "projects", "websites"] as const)(
    "%s: id w ustawieniach wskazują pola i opcje z bloku",
    (key) => {
      const blok = buildTemplateBlocks(key, seqId()).find((b) => b.type === "table")!;
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
    const blok = buildTemplateBlocks("books", seqId()).find((b) => b.type === "table")!;
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
    const blok = buildTemplateBlocks("projects", seqId()).find((b) => b.type === "table")!;
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
    const blok = buildTemplateBlocks("websites", seqId()).find((b) => b.type === "table")!;
    expect(blok.fields.map((f) => f.name)).toEqual(["Nazwa", "URL", "Klient", "Status", "Hosting"]);
    expect(blok.fields[0].config.empty_label).toBe("Bez nazwy");
    expect(blok.fields.find((f) => f.name === "Status")?.config.options?.map((o) => o.label)).toEqual([
      "Na żywo",
      "W budowie",
      "Wycena",
      "Wstrzymana",
    ]);
  });

  it("kolory opcji mieszczą się w palecie 8 kolorów", () => {
    for (const key of ["books", "projects", "websites"] as const) {
      for (const f of buildTemplateBlocks(key, seqId()).find((b) => b.type === "table")!.fields) {
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
    expect(TEMPLATES.empty.desc).toBe("Zacznij od zera");
    expect(TEMPLATES.books.desc).toBe("Twoje książki: czytane, przeczytane i na później.");
    expect(TEMPLATES.projects.desc).toBe("Projekty na studia, własne i dla klientów.");
    expect(TEMPLATES.websites.desc).toBe("Strony, które zbudowałeś albo budujesz dla klientów.");
    expect(TEMPLATES.books.extra).toBe("Liczba przeczytanych w tym roku.");
    expect(TEMPLATES.projects.extra).toBe("Terminy trafią do kalendarza głównego.");
  });

  it("mapuje nazwy z onboardingu", () => {
    expect(PENDING_TO_TEMPLATE).toEqual({
      Books: "books",
      Projects: "projects",
      Websites: "websites",
    });
  });
});

describe("Hasła to moduł, nie szablon", () => {
  it("TEMPLATE_KEYS nie zawiera passwords", () => {
    expect(TEMPLATE_KEYS).toEqual(["empty", "books", "projects", "websites", "subscriptions"]);
  });
});


describe("szablon Subscriptions", () => {
  function zbuduj() {
    const bloki = buildTemplateBlocks("subscriptions", seqId());
    const tabela = bloki.find((b) => b.type === "table")!;
    const pole = (nazwa: string) => tabela.fields.find((f) => f.name === nazwa)!;
    return { bloki, tabela, pole, settings: tabela.content.settings as TableSettings };
  }

  it("opis, ikona i pola w kolejności z makiety", () => {
    const { bloki, tabela } = zbuduj();
    expect(TEMPLATES.subscriptions).toMatchObject({
      name: "Subskrypcje",
      icon: "lucide:wallet",
      desc: "Twoje subskrypcje i ich odnowienia.",
      intro: "Twoje subskrypcje i ich odnowienia.",
      extra: "Sumy na miesiąc i rok. Odnowienia trafią do kalendarza głównego.",
    });
    expect(bloki[0]).toMatchObject({ type: "text", content: { text: "Twoje subskrypcje i ich odnowienia." } });
    expect(tabela.fields.map((f) => [f.name, f.type])).toEqual([
      ["Nazwa", "text"],
      ["Kwota cykliczna", "recurring"],
      ["Data odnowienia", "renewal"],
      ["Kategoria", "select"],
      ["Aktywna", "checkbox"],
    ]);
    expect(tabela.fields[0].is_title).toBe(true);
    expect(tabela.fields[0].config).toEqual({ empty_label: "Bez nazwy" });
  });

  it("pole odnowienia wskazuje id pola kwoty i checkboxa z tego samego bloku", () => {
    const { pole } = zbuduj();
    const config = pole("Data odnowienia").config;
    expect(config.cycle_field_id).toBe(pole("Kwota cykliczna").id);
    expect(config.active_field_id).toBe(pole("Aktywna").id);
    expect(config.show_in_calendar).toBe(true);
    expect(pole("Kwota cykliczna").config).toEqual({ default_cycle: "month" });
  });

  it("Aktywna ma default_checked, a Kategoria opcje bez koloru i domyślną „Inne”", () => {
    const { pole } = zbuduj();
    expect(pole("Aktywna").config).toEqual({ default_checked: true });
    const kat = pole("Kategoria").config;
    expect(kat.options?.map((o) => o.label)).toEqual(["Rozrywka", "Chmura", "Zdrowie", "Praca", "Sport", "Nauka", "Inne"]);
    expect(kat.options?.every((o) => o.color === "")).toBe(true);
    expect(kat.options?.find((o) => o.id === kat.default_option)?.label).toBe("Inne");
  });

  it("karty, sort i stopki wskazują id pól", () => {
    const { pole, settings } = zbuduj();
    expect(settings.pinned_cards).toEqual([
      { label: "Σ miesięcznie", field_id: pole("Kwota cykliczna").id, aggregation: "sum_month" },
      { label: "Σ rocznie", field_id: pole("Kwota cykliczna").id, aggregation: "sum_year" },
      { label: "Najbliższe odnowienie", field_id: pole("Data odnowienia").id, aggregation: "next_renewal" },
    ]);
    expect(settings.sort).toEqual([{ field_id: pole("Data odnowienia").id, dir: "asc" }]);
    expect(settings.column_summaries[pole("Kwota cykliczna").id]).toEqual({ kind: "sum_month" });
    expect(settings.column_summaries[pole("Data odnowienia").id]).toEqual({ kind: "in_calendar" });
    expect(settings.column_summaries[pole("Nazwa").id]).toEqual({
      kind: "count",
      unit: ["subskrypcja", "subskrypcje", "subskrypcji"],
    });
  });

  it("id pól są unikalne, a w configach nie zostają klucze szablonu", () => {
    const { tabela } = zbuduj();
    const idy = tabela.fields.map((f) => f.id);
    expect(new Set(idy).size).toBe(idy.length);
    const config = tabela.fields.find((f) => f.type === "renewal")!.config;
    expect(idy).toContain(config.cycle_field_id);
    expect(idy).toContain(config.active_field_id);
  });

  it("onboarding bez zmian: PENDING_TO_TEMPLATE nie zna Subscriptions", () => {
    expect(PENDING_TO_TEMPLATE.Subscriptions).toBeUndefined();
  });
});


// Pola szablonu jako PageField z buildTemplateBlocks (te same id co w bloku)
function polaSzablonu(key: "books" | "projects" | "websites" | "subscriptions"): PageField[] {
  const tabela = buildTemplateBlocks(key, seqId()).find((b) => b.type === "table")!;
  return tabela.fields.map((f, i) => ({ id: f.id, name: f.name, type: f.type, config: f.config, position: i, isTitle: f.is_title }));
}

describe("szablony po polsku", () => {
  it("nazwy, opisy, tekst przycisku i rzeczownik z makiety S2Table", () => {
    expect(TEMPLATES.books).toMatchObject({ name: "Książki", newLabel: "Nowa książka", noun: ["książka", "książki", "książek"] });
    expect(TEMPLATES.projects).toMatchObject({ name: "Projekty", newLabel: "Nowy projekt", noun: ["projekt", "projekty", "projektów"] });
    expect(TEMPLATES.websites).toMatchObject({ name: "Strony WWW", newLabel: "Nowa strona", noun: ["strona", "strony", "stron"] });
    expect(TEMPLATES.subscriptions).toMatchObject({
      name: "Subskrypcje",
      newLabel: "Nowa subskrypcja",
      noun: ["subskrypcja", "subskrypcje", "subskrypcji"],
    });
    expect(TEMPLATES.empty).toMatchObject({ newLabel: "Nowy wiersz", noun: ["wiersz", "wiersze", "wierszy"] });
  });

  it("stare angielskie tytuły do migracji", () => {
    expect(LEGACY_TEMPLATE_TITLES).toEqual({
      books: "Books",
      projects: "Projects",
      websites: "Websites",
      subscriptions: "Subscriptions",
    });
  });
});

describe("templateViews", () => {
  it("books: Czytam, Do przeczytania i Przeczytane w bieżącym roku (this_year)", () => {
    const pola = polaSzablonu("books");
    const widoki = templateViews("books", pola, 2027);
    expect(widoki.map((w) => w.name)).toEqual(["Czytam", "Do przeczytania", "Przeczytane w 2027"]);
    const status = pola.find((f) => f.name === "Status")!;
    const opcja = (etykieta: string) => status.config.options!.find((o) => o.label === etykieta)!.id;
    expect(widoki[0].filters).toEqual([{ field_id: status.id, op: "in", value: [opcja("Czytam")] }]);
    expect(widoki[1].filters).toEqual([{ field_id: status.id, op: "in", value: [opcja("Chcę przeczytać")] }]);
    const przeczytana = pola.find((f) => f.name === "Przeczytana")!;
    expect(widoki[2].filters).toEqual([
      { field_id: status.id, op: "in", value: [opcja("Przeczytane")] },
      { field_id: przeczytana.id, op: "this_year" },
    ]);
  });

  it("books: nazwa trzeciego widoku bierze rok z zegara, gdy go nie podano", () => {
    const widoki = templateViews("books", polaSzablonu("books"));
    expect(widoki[2].name).toBe(`Przeczytane w ${new Date().getFullYear()}`);
  });

  it("subscriptions: Aktywne, Odnowienie w 14 dni, Wstrzymane", () => {
    const pola = polaSzablonu("subscriptions");
    const widoki = templateViews("subscriptions", pola);
    expect(widoki.map((w) => w.name)).toEqual(["Aktywne", "Odnowienie w 14 dni", "Wstrzymane"]);
    const aktywna = pola.find((f) => f.name === "Aktywna")!;
    const odnowienie = pola.find((f) => f.name === "Data odnowienia")!;
    expect(widoki[0].filters).toEqual([{ field_id: aktywna.id, op: "checked" }]);
    expect(widoki[1].filters).toEqual([
      { field_id: aktywna.id, op: "checked" },
      { field_id: odnowienie.id, op: "within_days", value: 14 },
    ]);
    expect(widoki[2].filters).toEqual([{ field_id: aktywna.id, op: "unchecked" }]);
  });

  it("projects: W toku i Archiwum po Statusie", () => {
    const pola = polaSzablonu("projects");
    const widoki = templateViews("projects", pola);
    expect(widoki.map((w) => w.name)).toEqual(["W toku", "Archiwum"]);
    const status = pola.find((f) => f.name === "Status")!;
    expect(widoki[1].filters).toEqual([
      { field_id: status.id, op: "in", value: [status.config.options!.find((o) => o.label === "Zrobione")!.id] },
    ]);
  });

  it("websites: Na żywo, W budowie i Dla klientów (Klient różny od „ja”)", () => {
    const pola = polaSzablonu("websites");
    const widoki = templateViews("websites", pola);
    expect(widoki.map((w) => w.name)).toEqual(["Na żywo", "W budowie", "Dla klientów"]);
    const klient = pola.find((f) => f.name === "Klient")!;
    expect(widoki[2].filters).toEqual([{ field_id: klient.id, op: "not_equals", value: "ja" }]);
  });

  it("widoki mają unikalne id, układ tabeli i brak grup", () => {
    const widoki = templateViews("websites", polaSzablonu("websites"));
    expect(new Set(widoki.map((w) => w.id)).size).toBe(3);
    expect(widoki[0]).toMatchObject({ sort: [], group_by: null, layout: "table", hidden_field_ids: [] });
  });

  it("widok z polem, które użytkownik usunął, jest pomijany", () => {
    const pola = polaSzablonu("subscriptions").filter((f) => f.name !== "Data odnowienia");
    expect(templateViews("subscriptions", pola).map((w) => w.name)).toEqual(["Aktywne", "Wstrzymane"]);
  });
});

describe("templateDefaults: grupowanie i zwinięte grupy", () => {
  it("projects grupuje po Statusie i zwija Zrobione", () => {
    const pola = polaSzablonu("projects");
    const status = pola.find((f) => f.name === "Status")!;
    const zrobione = status.config.options!.find((o) => o.label === "Zrobione")!.id;
    expect(templateDefaults("projects", pola)).toMatchObject({ group_by: status.id, collapsed_groups: { all: [zrobione] } });
  });

  it("subscriptions grupuje po Kategorii, books i websites po Statusie, bez zwiniętych", () => {
    const sub = polaSzablonu("subscriptions");
    expect(templateDefaults("subscriptions", sub)).toMatchObject({
      group_by: sub.find((f) => f.name === "Kategoria")!.id,
      collapsed_groups: {},
    });
    const books = polaSzablonu("books");
    expect(templateDefaults("books", books).group_by).toBe(books.find((f) => f.name === "Status")!.id);
    const web = polaSzablonu("websites");
    expect(templateDefaults("websites", web).group_by).toBe(web.find((f) => f.name === "Status")!.id);
  });

  it("passwords: widoki po Kategorii (Praca, Studia, Prywatne) i grupowanie po niej", () => {
    const kategoria: PageField = {
      id: "k1",
      name: "Kategoria",
      type: "select",
      config: {
        options: [
          { id: "o1", label: "Praca", color: "" },
          { id: "o2", label: "Studia", color: "" },
        ],
      },
      position: 4,
      isTitle: false,
    };
    const wynik = templateDefaults("passwords", [kategoria]);
    expect(wynik.group_by).toBe("k1");
    // Brak opcji „Prywatne” (użytkownik ją usunął) pomija tylko ten widok
    expect(wynik.views.map((w) => [w.name, w.filters])).toEqual([
      ["Praca", [{ field_id: "k1", op: "in", value: ["o1"] }]],
      ["Studia", [{ field_id: "k1", op: "in", value: ["o2"] }]],
    ]);
  });
});

describe("templateSummaries (S2Table: opis pod tabelą i podsumowanie grupy)", () => {
  it("Książki: stopka liczy „Czytam” jako „w trakcie”, grupa ma średnią ocenę z etykietą „śr. ocena”", () => {
    const pola = polaSzablonu("books");
    const status = pola.find((f) => f.name === "Status")!;
    const czytam = status.config.options!.find((o) => o.label === "Czytam")!.id;
    const ocena = pola.find((f) => f.name === "Ocena")!;
    const w = templateSummaries("books", pola);
    expect(w.footer).toEqual({
      field_id: status.id,
      summary: { kind: "count_option", option_id: czytam, unit: ["w trakcie", "w trakcie", "w trakcie"] },
    });
    expect(w.group).toEqual({ field_id: ocena.id, kind: "avg", label: "śr. ocena" });
  });

  it("Projekty: „w toku” i najbliższy termin bez grupy „Zrobione”; Subskrypcje: suma miesięczna; Strony WWW: „na żywo” bez grupy", () => {
    const projekty = polaSzablonu("projects");
    const zrobione = projekty.find((f) => f.name === "Status")!.config.options!.find((o) => o.label === "Zrobione")!.id;
    const p = templateSummaries("projects", projekty);
    expect(p.footer?.summary.unit).toEqual(["w toku", "w toku", "w toku"]);
    expect(p.group).toEqual({
      field_id: projekty.find((f) => f.name === "Termin")!.id,
      kind: "nearest",
      label: "najbliższy termin",
      skip_option_id: zrobione,
    });
    const subs = polaSzablonu("subscriptions");
    const kwota = subs.find((f) => f.type === "recurring")!;
    expect(templateSummaries("subscriptions", subs)).toEqual({
      footer: { field_id: kwota.id, summary: { kind: "sum_month" } },
      group: { field_id: kwota.id, kind: "sum_month" },
    });
    const www = templateSummaries("websites", polaSzablonu("websites"));
    expect(www.footer?.summary.unit).toEqual(["na żywo", "na żywo", "na żywo"]);
    expect(www.group).toBeNull();
  });

  it("brak szablonu, pusta strona, Hasła albo brakujące pole / opcja: null", () => {
    expect(templateSummaries(null, [])).toEqual({ footer: null, group: null });
    expect(templateSummaries("empty", [])).toEqual({ footer: null, group: null });
    expect(templateSummaries("passwords", [])).toEqual({ footer: null, group: null });
    const bezStatusu = polaSzablonu("books").filter((f) => f.name !== "Status");
    expect(templateSummaries("books", bezStatusu).footer).toBeNull();
    const bezOpcji = polaSzablonu("books").map((f) =>
      f.name === "Status" ? { ...f, config: { ...f.config, options: [] } } : f,
    );
    expect(templateSummaries("books", bezOpcji).footer).toBeNull();
  });
});
