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

  it("włącza RLS i ma 4 polityki po auth.uid()", () => {
    expect(bezKomentarzy).toMatch(/alter table public\.vaults enable row level security/i);
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(bezKomentarzy).toMatch(new RegExp(`create policy "vaults_${op}_own" on public\\.vaults\\s+for ${op}`, "i"));
    }
    const polityki = bezKomentarzy.match(/create policy "vaults_[a-z]+_own"[\s\S]*?;/gi) ?? [];
    expect(polityki).toHaveLength(4);
    for (const p of polityki) expect(p).toMatch(/user_id = \(select auth\.uid\(\)\)/);
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
