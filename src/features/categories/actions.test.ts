import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
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
  { id: "k1", name: "Nauka", color: "#0070f3", position: 1, is_system: false, hidden: false },
  { id: "k2", name: "Praca", color: "#15803d", position: 2, is_system: false, hidden: false },
  { id: "k3", name: "Inne", color: "#525252", position: 3, is_system: true, hidden: false },
];

let kategorie: ReturnType<typeof fakeTable>;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  kategorie = fakeTable({ data: lista[0] });
  from.mockImplementation(() => kategorie);
});

describe("createCategory", () => {
  it("bez sesji → redirect na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(createCategory({ name: "X", color: "#0070f3" })).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("odrzuca pustą nazwę, za długą nazwę i kolor spoza palety", async () => {
    expect((await createCategory({ name: "  ", color: "#0070f3" })).ok).toBe(false);
    expect((await createCategory({ name: "x".repeat(31), color: "#0070f3" })).ok).toBe(false);
    expect((await createCategory({ name: "Ok", color: "#123456" })).ok).toBe(false);
    expect(kategorie.insert).not.toHaveBeenCalled();
  });

  it("zapisuje przyciętą nazwę z position = max + 1", async () => {
    kategorie = fakeTable({ data: { position: 3, id: "nowa" } });
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
    await updateCategory({ id: "k1", name: " Studia ", color: "#c2410c" });
    expect(kategorie.update).toHaveBeenCalledWith({ name: "Studia", color: "#c2410c" });
  });

  it("updateCategory na systemowej → ok: false", async () => {
    kategorie = fakeTable({ data: lista[2] });
    expect((await updateCategory({ id: "k3", name: "Zmiana" })).ok).toBe(false);
    expect(kategorie.update).not.toHaveBeenCalled();
  });

  it("setCategoryHidden działa także na systemowej", async () => {
    kategorie = fakeTable({ data: lista[2] });
    expect((await setCategoryHidden({ id: "k3", hidden: true })).ok).toBe(true);
    expect(kategorie.update).toHaveBeenCalledWith({ hidden: true });
  });

  it("deleteCategory na systemowej → ok: false, bez delete", async () => {
    kategorie = fakeTable({ data: lista[2] });
    expect((await deleteCategory({ id: "k3" })).ok).toBe(false);
    expect(kategorie.delete).not.toHaveBeenCalled();
  });

  it("deleteCategory usuwa własną", async () => {
    expect((await deleteCategory({ id: "k1" })).ok).toBe(true);
    expect(kategorie.delete).toHaveBeenCalled();
  });
});

describe("moveCategory", () => {
  it("zamienia position z sąsiadem", async () => {
    kategorie = fakeTable({ data: lista });
    const w = await moveCategory({ id: "k1", dir: 1 });
    expect(w.ok).toBe(true);
    expect(kategorie.update).toHaveBeenCalledWith({ position: 2 });
    expect(kategorie.update).toHaveBeenCalledWith({ position: 1 });
    expect(kategorie.eq).toHaveBeenCalledWith("id", "k1");
    expect(kategorie.eq).toHaveBeenCalledWith("id", "k2");
  });

  it("na brzegu listy nic nie zmienia", async () => {
    kategorie = fakeTable({ data: lista });
    const w = await moveCategory({ id: "k1", dir: -1 });
    expect(w.ok).toBe(true);
    expect(kategorie.update).not.toHaveBeenCalled();
  });
});
