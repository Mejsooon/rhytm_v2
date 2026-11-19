import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addBlock } = vi.hoisted(() => ({ addBlock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("../actions", () => ({
  addBlock,
  deleteBlock: vi.fn(),
  restoreBlock: vi.fn(),
  updateBlockContent: vi.fn(),
}));

import type { LoadedBlock } from "../load-page";
import { useEditorStore } from "./use-editor-store";

function pole(id: string, position: number) {
  return {
    id,
    name: id,
    type: "text" as const,
    config: {},
    position,
    isTitle: position === 0,
  };
}
const pelnaTabela: LoadedBlock = {
  id: "t1",
  type: "table",
  position: 0,
  content: { name: "" },
  fields: [pole("f1", 0), pole("f2", 1), pole("f3", 2)],
  rows: [],
};
const tabelaBezPol: LoadedBlock = { ...pelnaTabela, fields: [] };

describe("useEditorStore — odświeżenie danych z serwera po dodaniu bloku", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addBlock.mockResolvedValue({ ok: true, block: pelnaTabela });
  });

  async function dodajTabele() {
    const poczatkowe: LoadedBlock[] = [];
    const hook = renderHook(({ initial }) => useEditorStore("p1", initial), {
      initialProps: { initial: poczatkowe },
    });
    await act(async () => {
      await hook.result.current.add("table");
    });
    expect(hook.result.current.blocks).toHaveLength(1);
    return hook;
  }

  it("nieaktualne dane bez bloku nie gubią świeżo dodanej tabeli", async () => {
    const hook = await dodajTabele();
    hook.rerender({ initial: [] });
    expect(hook.result.current.blocks).toHaveLength(1);
    expect(hook.result.current.blocks[0].fields).toHaveLength(3);
  });

  it("kopia serwera bez pól (odczyt między wstawieniem bloku i pól) nie zastępuje lokalnej", async () => {
    const hook = await dodajTabele();
    hook.rerender({ initial: [tabelaBezPol] });
    expect(hook.result.current.blocks).toHaveLength(1);
    expect(hook.result.current.blocks[0].fields).toHaveLength(3);
  });

  it("pełne dane z serwera zastępują kopię bez duplikatu, a potem serwer wygrywa", async () => {
    const hook = await dodajTabele();
    hook.rerender({ initial: [] });
    const zSerwera = { ...pelnaTabela, content: { name: "Z serwera" } };
    hook.rerender({ initial: [zSerwera] });
    expect(hook.result.current.blocks).toHaveLength(1);
    expect(hook.result.current.blocks[0].content).toEqual({
      name: "Z serwera",
    });
    // Serwer dogonił, więc kolejne dane bez bloku (np. usunięty gdzie indziej) go usuwają
    hook.rerender({ initial: [] });
    expect(hook.result.current.blocks).toHaveLength(0);
  });
});
