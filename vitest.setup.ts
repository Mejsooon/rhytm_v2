// Matchery jest-dom (toBeInTheDocument itd.) dla Vitesta
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Bez globals RTL nie sprząta sam — odmontuj drzewa po każdym teście
afterEach(cleanup);

// jsdom nie ma ResizeObservera, którego używa Radix Popper (dymki)
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
