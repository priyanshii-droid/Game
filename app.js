// app.js — Entry point for FLICKIEGO
import { buildReverseSolutionTable } from "./engine.js";
import { createGameStore } from "./game-state.js";
import { createGameUI } from "./ui.js";

function initApp() {
  const rootEl = document.getElementById("app");
  if (!rootEl) return;

  const tablesBySize = new Map([
    ["2x2", buildReverseSolutionTable(2, 2)],
    ["3x3", buildReverseSolutionTable(3, 3)],
  ]);

  const store = createGameStore(tablesBySize);
  createGameUI(rootEl, store);
}

initApp();
