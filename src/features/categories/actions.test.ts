import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  createCategory,
  deleteCategory,
  moveCategory,
  setCategoryHidden,
  updateCategory,
} from "./actions";

const lista = [
  { id: "c1000000-0000-4000-8000-000000000001", name: "Nauka", color: "#0070f3", position: 1, is_system: false, hidden: false },
  { id: "c2000000-0000-4000-8000-000000000002", name: "Praca", color: "#15803d", position: 2, is_system: false, hidden: false },
  { id: "c3000000-0000-4000-8000-000000000003", name: "Inne", color: "#525252", position: 3, is_system: true, hidden: false },
];

let kategorie: ReturnType<typeof fakeTable>;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  rpc.mockResolvedValue({ error: null });
  kategorie = fakeTable({ data: [{ id: lista[0].id }], single: lista[0] });
  from.mockImplementation(() => kategorie);
});

describe("createCategory", () => {
  it("bez sesji → redirect na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(createCategory({ name: "X", color: "#0070f3" })).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("odrzuca pustą nazwę, za długą nazwę i kolor spoza palety", async () => {
    expect((await createCategory({ name: "  ", color: "#0070f3" })).ok).toBe(false);
    expect((await createCategory({ name: "e0000000-0000-4000-8000-000000000000".repeat(31), color: "#0070f3" })).ok).toBe(false);
    expect((await createCategory({ name: "Ok", color: "#123456" })).ok).toBe(false);
    expect(kategorie.insert).not.toHaveBeenCalled();
  });

  it("zapisuje przyciętą nazwę z position = max + 1", async () => {
    kategorie = fakeTable({ single: { position: 3, id: "nowa" } });
    const w = await createCategory({ name: " Sport ", color: "#7c3aed" });
    expect(w.ok).toBe(true);
    expect(kategorie.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", name: "Sport", color: "#7c3aed", position: 4, is_system: false }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });
});

describe("updateCategory / setCategoryHidden / deleteCategory", () => {
  it("updateCategory zmienia nazwę i kolor własnej kategorii", async () => {
    await updateCategory({ id: "c1000000-0000-4000-8000-000000000001", name: " Studia ", color: "#c2410c" });
    expect(kategorie.update).toHaveBeenCalledWith({ name: "Studia", color: "#c2410c" });
  });

  it("updateCategory na systemowej → ok: false", async () => {
    kategorie = fakeTable({ data: [{ id: lista[2].id }], single: lista[2] });
    expect((await updateCategory({ id: "c3000000-0000-4000-8000-000000000003", name: "Zmiana" })).ok).toBe(false);
    expect(kategorie.update).not.toHaveBeenCalled();
  });

  it("setCategoryHidden działa także na systemowej", async () => {
    kategorie = fakeTable({ data: [{ id: lista[2].id }], single: lista[2] });
    expect((await setCategoryHidden({ id: "c3000000-0000-4000-8000-000000000003", hidden: true })).ok).toBe(true);
    expect(kategorie.update).toHaveBeenCalledWith({ hidden: true });
  });

  it("deleteCategory na systemowej → ok: false, bez delete", async () => {
    kategorie = fakeTable({ data: [{ id: lista[2].id }], single: lista[2] });
    expect((await deleteCategory({ id: "c3000000-0000-4000-8000-000000000003" })).ok).toBe(false);
    expect(kategorie.delete).not.toHaveBeenCalled();
  });

  it("deleteCategory usuwa własną", async () => {
    expect((await deleteCategory({ id: "c1000000-0000-4000-8000-000000000001" })).ok).toBe(true);
    expect(kategorie.delete).toHaveBeenCalled();
  });
});

describe("moveCategory", () => {
  it("woła rpc move_category (zamiana atomowo w bazie)", async () => {
    const w = await moveCategory({ id: lista[0].id, dir: 1 });
    expect(w.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("move_category", { p_id: lista[0].id, p_dir: 1 });
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });

  it("błąd rpc → komunikat", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    expect((await moveCategory({ id: lista[0].id, dir: -1 })).ok).toBe(false);
  });
});

describe("brak dopasowanego wiersza", () => {
  it("setCategoryHidden / updateCategory / deleteCategory → ok: false", async () => {
    kategorie = fakeTable({ data: [], single: lista[0] });
    expect((await setCategoryHidden({ id: lista[0].id, hidden: true })).ok).toBe(false);
    expect((await updateCategory({ id: lista[0].id, name: "Nowa" })).ok).toBe(false);
    expect((await deleteCategory({ id: lista[0].id })).ok).toBe(false);
  });
});
