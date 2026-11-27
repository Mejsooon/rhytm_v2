import { expect, it } from "vitest";

import pkg from "../../../package.json";
import { WERSJA } from "./version";

it("wersja w menu pomocy = wersja z package.json", () => {
  expect(WERSJA).toBe(pkg.version);
});
