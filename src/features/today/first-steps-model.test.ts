import { describe, expect, it } from "vitest";
import { firstStepsDone } from "./first-steps-model";

const zDanych = { profil: true, blok: false, nawyk: false, trening: false, push: false, strona: false };

describe("firstStepsDone", () => {
  it("ręczny wybór wygrywa z danymi w obie strony; śmieci w kolumnie są pomijane", () => {
    expect(firstStepsDone({ profil: false, push: true, blok: "tak", inne: true }, zDanych)).toEqual({
      ...zDanych,
      profil: false,
      push: true,
    });
    expect(firstStepsDone(null, zDanych)).toEqual(zDanych);
  });
});
