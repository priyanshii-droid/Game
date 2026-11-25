// ui.js — Persistent DOM renderer and interaction controller for FLICKIEGO
import { TILE_STATE } from "./engine.js";

function stateToClass(tileValue) {
  if (tileValue === TILE_STATE.TERRACOTTA) return "tile--terracotta";
  if (tileValue === TILE_STATE.SAGE) return "tile--sage";
  return "tile--sand";
}

function stateToLabel(tileValue) {
  if (tileValue === TILE_STATE.TERRACOTTA) return "Terracotta, horizontal pulse";
  if (tileValue === TILE_STATE.SAGE) return "Sage, vertical pulse";
  return "Sand, neutral";
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createGameUI(rootEl, store) {
  const tileElements = [];
  const tileTimers = new Map();
  const boardTimers = new Set();

  let renderedRows = null;
  let renderedCols = null;
  let renderedLevel = null;
  let lastRenderedSeq = -1;
  let refs = null;

  function getTileTimerSet(tileIndex) {
    let bucket = tileTimers.get(tileIndex);
    if (!bucket) {
      bucket = new Set();
      tileTimers.set(tileIndex, bucket);
    }
    return bucket;
  }

  function clearTileTimers(tileIndex) {
    const bucket = tileTimers.get(tileIndex);
    if (!bucket) return;
    for (const timerId of bucket) {
      clearTimeout(timerId);
    }
    bucket.clear();
  }

  function clearAllTileTimers() {
    for (const bucket of tileTimers.values()) {
      for (const timerId of bucket) {
        clearTimeout(timerId);
      }
      bucket.clear();
    }
    tileTimers.clear();
  }

  function clearBoardTimers() {
    for (const timerId of boardTimers) {
      clearTimeout(timerId);
    }
    boardTimers.clear();
  }

  function clearAllTimers() {
    clearAllTileTimers();
    clearBoardTimers();
  }

  function scheduleTileTimer(tileIndex, fn, delayMs) {
    const bucket = getTileTimerSet(tileIndex);
    const timerId = setTimeout(() => {
      bucket.delete(timerId);
      fn();
    }, delayMs);
    bucket.add(timerId);
    return timerId;
  }

  function scheduleBoardTimer(fn, delayMs) {
    const timerId = setTimeout(() => {
      boardTimers.delete(timerId);
      fn();
    }, delayMs);
    boardTimers.add(timerId);
    return timerId;
  }

  function clearTileMotionClasses(el) {
    el.classList.remove(
      "tile--tapped",
      "tile--tapped-release",
      "tile--rippled",
      "tile--cleared-settle"
    );
  }

  function animateTappedTile(tileEl, tileIndex) {
    if (prefersReducedMotion()) return;

    clearTileTimers(tileIndex);
    clearTileMotionClasses(tileEl);
    void tileEl.offsetWidth;
    tileEl.classList.add("tile--tapped");

    scheduleTileTimer(
      tileIndex,
      () => {
        if (!tileEl.isConnected) return;
        tileEl.classList.remove("tile--tapped");
        tileEl.classList.add("tile--tapped-release");

        scheduleTileTimer(
          tileIndex,
          () => {
            if (!tileEl.isConnected) return;
            tileEl.classList.remove("tile--tapped-release");
          },
          110
        );
      },
      65
    );
  }

  function animateRippledTile(tileEl, tileIndex, staggerIndex) {
    if (prefersReducedMotion()) return;

    clearTileTimers(tileIndex);
    const delay = 30 + staggerIndex * 35;

    scheduleTileTimer(
      tileIndex,
      () => {
        if (!tileEl.isConnected) return;
        clearTileMotionClasses(tileEl);
        void tileEl.offsetWidth;
        tileEl.classList.add("tile--rippled");

        scheduleTileTimer(
          tileIndex,
          () => {
            if (!tileEl.isConnected) return;
            tileEl.classList.remove("tile--rippled");
          },
          185
        );
      },
      delay
    );
  }

  function animateSolvedBoard() {
    if (prefersReducedMotion()) return;

    tileElements.forEach((tileEl, idx) => {
      clearTileTimers(idx);
      scheduleTileTimer(
        idx,
        () => {
          if (!tileEl.isConnected) return;
          clearTileMotionClasses(tileEl);
          void tileEl.offsetWidth;
          tileEl.classList.add("tile--cleared-settle");

          scheduleTileTimer(
            idx,
            () => {
              if (!tileEl.isConnected) return;
              tileEl.classList.remove("tile--cleared-settle");
            },
            260
          );
        },
        idx * 24
      );
    });
  }

  function triggerLevelEnter(boardFrameEl) {
    if (prefersReducedMotion() || !boardFrameEl) return;

    clearBoardTimers();
    boardFrameEl.classList.remove("board-frame--level-enter");
    void boardFrameEl.offsetWidth;
    boardFrameEl.classList.add("board-frame--level-enter");

    scheduleBoardTimer(() => {
      if (!boardFrameEl.isConnected) return;
      boardFrameEl.classList.remove("board-frame--level-enter");
    }, 210);
  }

  function ensureShellMounted(state) {
    if (renderedRows === state.rows && renderedCols === state.cols && tileElements.length > 0 && refs) {
      return;
    }

    clearAllTimers();
    tileElements.length = 0;
    renderedRows = state.rows;
    renderedCols = state.cols;

    const gridClass = state.rows === 2 ? "grid--2x2" : "grid--3x3";

    rootEl.innerHTML = `
      <header class="top-bar">
        <h1 class="brand-title">FLICKIEGO</h1>
        <span class="level-label" data-role="level-label"></span>
      </header>

      <section class="stats-row" aria-label="Puzzle progress">
        <div class="stat-box">
          <span class="stat-title">Moves</span>
          <span class="stat-value" data-testid="move-count" data-role="move-count"></span>
        </div>
        <div class="stat-box">
          <span class="stat-title">Par</span>
          <span class="stat-value" data-testid="par-count" data-role="par-count"></span>
        </div>
      </section>

      <section class="board-frame" data-role="board-frame" aria-label="${state.rows} by ${state.cols} puzzle grid">
        <div class="grid ${gridClass}" role="grid" data-role="grid"></div>
      </section>

      <section class="controls-row" aria-label="Board actions">
        <button type="button" class="btn btn--secondary" data-action="undo">
          Undo
        </button>
        <button type="button" class="btn btn--secondary" data-action="restart">
          Restart
        </button>
      </section>

      <p class="limitation-note" data-role="note-slot" role="status" hidden></p>

      <div data-role="win-slot"></div>
    `;

    const gridEl = rootEl.querySelector('[data-role="grid"]');
    const fragment = document.createDocumentFragment();

    for (let idx = 0; idx < state.rows * state.cols; idx++) {
      const r = Math.floor(idx / state.cols);
      const c = idx % state.cols;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile tile--sand";
      btn.dataset.index = String(idx);
      btn.dataset.row = String(r);
      btn.dataset.col = String(c);

      const indicator = document.createElement("span");
      indicator.className = "tile__indicator";
      indicator.setAttribute("aria-hidden", "true");
      btn.appendChild(indicator);

      fragment.appendChild(btn);
      tileElements.push(btn);
    }

    gridEl.appendChild(fragment);

    refs = {
      levelLabelEl: rootEl.querySelector('[data-role="level-label"]'),
      moveCountEl: rootEl.querySelector('[data-role="move-count"]'),
      parCountEl: rootEl.querySelector('[data-role="par-count"]'),
      boardFrameEl: rootEl.querySelector('[data-role="board-frame"]'),
      undoBtn: rootEl.querySelector('[data-action="undo"]'),
      restartBtn: rootEl.querySelector('[data-action="restart"]'),
      noteSlotEl: rootEl.querySelector('[data-role="note-slot"]'),
      winSlotEl: rootEl.querySelector('[data-role="win-slot"]'),
    };
  }

  function renderWinBanner(state) {
    if (!state.isSolved) {
      refs.winSlotEl.innerHTML = "";
      refs.boardFrameEl.classList.remove("board-frame--solved");
      return;
    }

    refs.boardFrameEl.classList.add("board-frame--solved");

    const isExactPar = state.moveCount === state.par;
    const statusBadge = isExactPar ? "At Par" : "Solved";
    const detailText = isExactPar
      ? "Matched the minimum move target."
      : `Minimum target for this board is ${state.par}.`;

    refs.winSlotEl.innerHTML = `
      <section class="win-banner" data-testid="win-state" aria-label="Level completed">
        <div class="win-banner__header">
          <h2 class="win-banner__heading">Grid Cleared</h2>
          <span class="win-banner__tag ${isExactPar ? "win-banner__tag--optimal" : ""}">${statusBadge}</span>
        </div>
        <p class="win-banner__summary">Moves: ${state.moveCount} &middot; Par: ${state.par}</p>
        <p class="win-banner__detail">${detailText}</p>
        <button type="button" class="btn btn--primary" data-action="next-level">
          Next Level
        </button>
      </section>
    `;
  }

  function render(state) {
    ensureShellMounted(state);

    const levelChanged = renderedLevel !== null && renderedLevel !== state.level;
    const isUndoOrRestart =
      state.tapSeq !== lastRenderedSeq &&
      state.lastTapIndex === null &&
      state.lastRippledIndices.length === 0 &&
      !levelChanged;

    renderedLevel = state.level;

    if (levelChanged || isUndoOrRestart) {
      clearAllTileTimers();
      for (const tileEl of tileElements) {
        clearTileMotionClasses(tileEl);
      }
    }

    refs.levelLabelEl.textContent = `Level ${String(state.level).padStart(2, "0")}`;
    refs.moveCountEl.textContent = String(state.moveCount).padStart(2, "0");
    refs.parCountEl.textContent = String(state.par).padStart(2, "0");

    refs.undoBtn.disabled = state.history.length === 0;
    refs.restartBtn.disabled = state.moveCount === 0;

    if (state.limitationNote) {
      refs.noteSlotEl.textContent = state.limitationNote;
      refs.noteSlotEl.hidden = false;
    } else {
      refs.noteSlotEl.textContent = "";
      refs.noteSlotEl.hidden = true;
    }

    for (let idx = 0; idx < state.board.length; idx++) {
      const tileEl = tileElements[idx];
      const val = state.board[idx];
      const r = Math.floor(idx / state.cols);
      const c = idx % state.cols;

      tileEl.classList.remove("tile--sand", "tile--terracotta", "tile--sage");
      tileEl.classList.add(stateToClass(val));
      tileEl.setAttribute("aria-label", `Row ${r + 1}, Column ${c + 1}: ${stateToLabel(val)}`);
      tileEl.disabled = Boolean(state.isSolved);
    }

    if (levelChanged) {
      triggerLevelEnter(refs.boardFrameEl);
    }

    if (state.tapSeq !== lastRenderedSeq) {
      lastRenderedSeq = state.tapSeq;

      if (state.lastTapIndex !== null && tileElements[state.lastTapIndex]) {
        animateTappedTile(tileElements[state.lastTapIndex], state.lastTapIndex);
      }

      state.lastRippledIndices.forEach((rIdx, i) => {
        if (tileElements[rIdx]) {
          animateRippledTile(tileElements[rIdx], rIdx, i);
        }
      });

      if (state.isSolved) {
        animateSolvedBoard();
      }
    }

    renderWinBanner(state);
  }

  function handleRootClick(event) {
    const tileBtn = event.target.closest(".tile");
    if (tileBtn && !tileBtn.disabled) {
      const row = Number(tileBtn.dataset.row);
      const col = Number(tileBtn.dataset.col);
      store.tapTile(row, col);
      return;
    }

    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn || actionBtn.disabled) return;

    const action = actionBtn.dataset.action;
    if (action === "undo") store.undo();
    else if (action === "restart") store.restart();
    else if (action === "next-level") store.nextLevel();
  }

  rootEl.addEventListener("click", handleRootClick);
  render(store.getState());
  const unsubscribe = store.subscribe(render);

  return () => {
    unsubscribe();
    rootEl.removeEventListener("click", handleRootClick);
    clearAllTimers();
  };
}
