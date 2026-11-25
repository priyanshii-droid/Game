// game-state.js — Pure state transitions for FLICKIEGO
import { applyTap, isBoardSolved } from "./engine.js";
import { createLevelPuzzle } from "./levels.js";

function getAffectedIndices(rows, cols, row, col, newState) {
  const rippled = [];
  if (newState === 1) {
    if (col - 1 >= 0) rippled.push(row * cols + (col - 1));
    if (col + 1 < cols) rippled.push(row * cols + (col + 1));
  } else if (newState === 2) {
    if (row - 1 >= 0) rippled.push((row - 1) * cols + col);
    if (row + 1 < rows) rippled.push((row + 1) * cols + col);
  }
  return rippled;
}

export function createGameStore(tablesBySize, seenKeys = new Set(), rng = Math.random) {
  let state = createLevelPuzzle(1, tablesBySize, seenKeys, rng);
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) {
      listener(getState());
    }
  }

  function getState() {
    return {
      ...state,
      board: state.board.slice(),
      initialBoard: state.initialBoard.slice(),
      history: state.history.map((snap) => snap.slice()),
      lastRippledIndices: state.lastRippledIndices.slice(),
    };
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function tapTile(row, col) {
    if (state.isSolved) return getState();

    const previousSnapshot = state.board.slice();
    const nextBoard = applyTap(state.board, state.rows, state.cols, row, col);
    const tappedIndex = row * state.cols + col;
    const newTileState = nextBoard[tappedIndex];
    const rippledIndices = getAffectedIndices(state.rows, state.cols, row, col, newTileState);
    const solvedNow = isBoardSolved(nextBoard);

    state = {
      ...state,
      board: nextBoard,
      moveCount: state.moveCount + 1,
      history: [...state.history, previousSnapshot],
      isSolved: solvedNow,
      lastTapIndex: tappedIndex,
      lastRippledIndices: rippledIndices,
      tapSeq: state.tapSeq + 1,
    };

    notify();
    return getState();
  }

  function undo() {
    if (state.history.length === 0) return getState();

    const nextHistory = state.history.slice(0, -1);
    const restoredBoard = state.history[state.history.length - 1].slice();

    state = {
      ...state,
      board: restoredBoard,
      moveCount: Math.max(0, state.moveCount - 1),
      history: nextHistory,
      isSolved: isBoardSolved(restoredBoard),
      lastTapIndex: null,
      lastRippledIndices: [],
      tapSeq: state.tapSeq + 1,
    };

    notify();
    return getState();
  }

  function restart() {
    state = {
      ...state,
      board: state.initialBoard.slice(),
      moveCount: 0,
      history: [],
      isSolved: false,
      lastTapIndex: null,
      lastRippledIndices: [],
      tapSeq: state.tapSeq + 1,
    };

    notify();
    return getState();
  }

  function nextLevel() {
    state = createLevelPuzzle(state.level + 1, tablesBySize, seenKeys, rng);
    notify();
    return getState();
  }

  return {
    getState,
    subscribe,
    tapTile,
    undo,
    restart,
    nextLevel,
  };
}
