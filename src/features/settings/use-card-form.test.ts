import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCardForm } from "./use-card-form";

const zapisane = { name: "Ala", kg: "" };

describe("useCardForm", () => {
  it("na starcie: wartości zapisane, bez zmian, komunikat idle", () => {
    const { result } = renderHook(() => useCardForm(zapisane));
    expect(result.current.value).toEqual(zapisane);
    expect(result.current.dirty).toBe(false);
    expect(result.current.message).toBe("idle");
  });

  it("zmiana pola → dirty i komunikat dirty", () => {
    const { result } = renderHook(() => useCardForm(zapisane));
    act(() => result.current.set({ name: "Ola" }));
    expect(result.current.value).toEqual({ name: "Ola", kg: "" });
    expect(result.current.dirty).toBe(true);
    expect(result.current.message).toBe("dirty");
  });

  it("dirty porównuje String() pól (liczba i tekst to to samo)", () => {
    const { result } = renderHook(() => useCardForm({ sleep: 480 as number | string }));
    act(() => result.current.set({ sleep: "480" }));
    expect(result.current.dirty).toBe(false);
  });

  it("reset() przywraca wartości zapisane", () => {
    const { result } = renderHook(() => useCardForm(zapisane));
    act(() => result.current.set({ name: "Ola" }));
    act(() => result.current.reset());
    expect(result.current.value).toEqual(zapisane);
    expect(result.current.dirty).toBe(false);
    expect(result.current.message).toBe("idle");
  });

  it("markSaved → komunikat saved, dirty false; ponowna zmiana → dirty", () => {
    const { result } = renderHook(() => useCardForm(zapisane));
    act(() => result.current.set({ name: "Ola" }));
    act(() => result.current.markSaved({ name: "Ola", kg: "" }));
    expect(result.current.message).toBe("saved");
    expect(result.current.dirty).toBe(false);
    act(() => result.current.set({ kg: "70" }));
    expect(result.current.message).toBe("dirty");
    expect(result.current.dirty).toBe(true);
  });
});
