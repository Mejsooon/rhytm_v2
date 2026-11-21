// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Statyczny test treści migracji sejfu (bez bazy): sprawdza kształt SQL.
const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261121180000_vault.sql"), "utf8");
const bezKomentarzy = sql.replace(/--.*$/gm, "");

describe("migracja sejfu", () => {
  it("tworzy tabelę vaults ze wszystkimi kolumnami", () => {
    expect(bezKomentarzy).toMatch(/create table public\.vaults\s*\(/i);
    expect(bezKomentarzy).toMatch(/user_id uuid primary key references auth\.users \(id\) on delete cascade default auth\.uid\(\)/i);
    expect(bezKomentarzy).toMatch(/status text not null default 'active' check \(status in \('active', 'reset'\)\)/i);
    expect(bezKomentarzy).toMatch(/kdf jsonb not null default '\{\}'/i);
    expect(bezKomentarzy).toMatch(/wrapped_key text not null default ''/i);
    expect(bezKomentarzy).toMatch(/wrap_iv text not null default ''/i);
    expect(bezKomentarzy).toMatch(/generation int not null default 1 check \(generation >= 1\)/i);
    expect(bezKomentarzy).toMatch(/created_at timestamptz not null default now\(\)/i);
    expect(bezKomentarzy).toMatch(/updated_at timestamptz not null default now\(\)/i);
  });

  it("włącza RLS i ma 3 polityki po auth.uid(), bez DELETE (konto kasuje się kaskadą)", () => {
    expect(bezKomentarzy).toMatch(/alter table public\.vaults enable row level security/i);
    for (const op of ["select", "insert", "update"]) {
      expect(bezKomentarzy).toMatch(new RegExp(`create policy "vaults_${op}_own" on public\\.vaults\\s+for ${op}`, "i"));
    }
    expect(bezKomentarzy).not.toMatch(/vaults_delete_own/i);
    expect(bezKomentarzy).not.toMatch(/for delete[\s\S]*?on public\.vaults|on public\.vaults\s+for delete/i);
    const polityki = bezKomentarzy.match(/create policy "vaults_[a-z]+_own"[\s\S]*?;/gi) ?? [];
    expect(polityki).toHaveLength(3);
    for (const p of polityki) expect(p).toMatch(/user_id = \(select auth\.uid\(\)\)/);
    // authenticated bez prawa DELETE
    expect(bezKomentarzy).toMatch(/grant select, insert, update on public\.vaults to authenticated;/i);
    expect(bezKomentarzy).not.toMatch(/grant[^;]*delete[^;]*on public\.vaults to authenticated/i);
  });

  it("trigger blokuje zmianę typu pola na secret i z secret (także przez change_field_type)", () => {
    const f = bezKomentarzy.match(/create function public\.page_fields_secret_type_guard\(\)[\s\S]*?\$\$;/i);
    expect(f).not.toBeNull();
    expect(f![0]).toMatch(/returns trigger/i);
    expect(f![0]).toMatch(/language plpgsql/i);
    expect(f![0]).toMatch(/security invoker/i);
    expect(f![0]).toMatch(/set search_path = ''/i);
    expect(f![0]).toMatch(/\(old\.type = 'secret' or new\.type = 'secret'\) and old\.type <> new\.type/i);
    expect(f![0]).toMatch(/raise exception/i);
    expect(bezKomentarzy).toMatch(
      /create trigger \w+\s+before update of type on public\.page_fields\s+for each row execute function public\.page_fields_secret_type_guard\(\)/i,
    );
  });

  it("trigger blokuje obniżenie vaults.generation", () => {
    const f = bezKomentarzy.match(/create function public\.vaults_generation_guard\(\)[\s\S]*?\$\$;/i);
    expect(f).not.toBeNull();
    expect(f![0]).toMatch(/returns trigger/i);
    expect(f![0]).toMatch(/security invoker/i);
    expect(f![0]).toMatch(/set search_path = ''/i);
    expect(f![0]).toMatch(/new\.generation < old\.generation/i);
    expect(f![0]).toMatch(/raise exception/i);
    expect(bezKomentarzy).toMatch(
      /create trigger \w+\s+before update on public\.vaults\s+for each row execute function public\.vaults_generation_guard\(\)/i,
    );
  });

  it("rozszerza check page_fields.type o 'secret'", () => {
    expect(bezKomentarzy).toMatch(/alter table public\.page_fields drop constraint if exists page_fields_type_check/i);
    expect(bezKomentarzy).toMatch(/add constraint page_fields_type_check[\s\S]*?'rating', 'secret'\)/i);
  });

  it("definiuje reset_vault i count_secrets jako security invoker", () => {
    for (const nazwa of ["reset_vault", "count_secrets"]) {
      const m = bezKomentarzy.match(new RegExp(`create function public\\.${nazwa}\\(\\)[\\s\\S]*?\\$\\$;`, "i"));
      expect(m, nazwa).not.toBeNull();
      expect(m![0]).toMatch(/returns int/i);
      expect(m![0]).toMatch(/security invoker/i);
      expect(m![0]).toMatch(/set search_path = ''/i);
    }
  });

  it("reset_vault czyści sekrety (także z kosza) i podbija generation bez usuwania wiersza", () => {
    const m = bezKomentarzy.match(/create function public\.reset_vault\(\)[\s\S]*?\$\$;/i)![0];
    expect(m).toMatch(/f\.type = 'secret'/);
    expect(m).not.toMatch(/deleted_at is null/i);
    expect(m).toMatch(/status = 'reset'/);
    expect(m).toMatch(/generation = (v\.)?generation \+ 1/);
    expect(m).toMatch(/kdf = '\{\}'::jsonb/);
    expect(m).toMatch(/wrapped_key = ''/);
    expect(m).toMatch(/wrap_iv = ''/);
    expect(m).not.toMatch(/delete from public\.vaults/i);
  });

  it("używa jawnego AS przy aliasach tabel", () => {
    expect(bezKomentarzy).not.toMatch(/\b(from|join|update)\s+public\.\w+\s+(?!as\b|set\b|where\b|on\b|using\b|for\b)[a-z]\w*\b/i);
  });
});
