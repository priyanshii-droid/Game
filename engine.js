// engine.js — FLICKIEGO Chromatic Ripple Mathematical Engine

export const TILE_STATE = Object.freeze({
  SAND: 0,
  TERRACOTTA: 1, // Horizontal pulse (left & right neighbors)
  SAGE: 2,       // Vertical pulse (top & bottom neighbors)
});

/**
 * Creates a solved board of size rows x cols filled with SAND (0).
 */
export function createSolvedBoard(rows, cols) {
  return new Array(rows * cols).fill(TILE_STATE.SAND);
}

/**
 * Checks whether all tiles on the board are SAND (0).
 */
export function isBoardSolved(board) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== TILE_STATE.SAND) return false;
  }
  return true;
}

/**
 * Converts a board array to a compact string key for maps/sets.
 */
export function encodeBoard(board) {
  return board.join(",");
}

/**
 * Decodes a string key back into a numeric array.
 */
export function decodeBoard(key) {
  return key.split(",").map(Number);
}

/**
 * Applies a single legal forward tap at (row, col) on a rows x cols board.
 * Returns a new board array without mutating the input.
 */
export function applyTap(board, rows, cols, row, col) {
  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    throw new RangeError(`Tile coordinate (${row}, ${col}) out of bounds for ${rows}x${cols}`);
  }

  const next = board.slice();
  const idx = row * cols + col;
  const newState = (next[idx] + 1) % 3;
  next[idx] = newState;

  if (newState === TILE_STATE.TERRACOTTA) {
    if (col - 1 >= 0) {
      const leftIdx = row * cols + (col - 1);
      next[leftIdx] = (next[leftIdx] + 1) % 3;
    }
    if (col + 1 < cols) {
      const rightIdx = row * cols + (col + 1);
      next[rightIdx] = (next[rightIdx] + 1) % 3;
    }
  } else if (newState === TILE_STATE.SAGE) {
    if (row - 1 >= 0) {
      const topIdx = (row - 1) * cols + col;
      next[topIdx] = (next[topIdx] + 1) % 3;
    }
    if (row + 1 < rows) {
      const bottomIdx = (row + 1) * cols + col;
      next[bottomIdx] = (next[bottomIdx] + 1) % 3;
    }
  }

  return next;
}

/**
 * Given a target board `targetBoard`, finds all predecessor boards `prevBoard`
 * such that applying a single legal forward tap at some (r, c) on `prevBoard`
 * produces `targetBoard`.
 */
export function getReversePredecessors(targetBoard, rows, cols) {
  const predecessors = [];
  const seenKeys = new Set();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const postTapState = targetBoard[idx];
      const preTapState = (postTapState + 2) % 3;

      const candidate = targetBoard.slice();
      candidate[idx] = preTapState;

      if (postTapState === TILE_STATE.TERRACOTTA) {
        if (c - 1 >= 0) {
          const leftIdx = r * cols + (c - 1);
          candidate[leftIdx] = (candidate[leftIdx] + 2) % 3;
        }
        if (c + 1 < cols) {
          const rightIdx = r * cols + (c + 1);
          candidate[rightIdx] = (candidate[rightIdx] + 2) % 3;
        }
      } else if (postTapState === TILE_STATE.SAGE) {
        if (r - 1 >= 0) {
          const topIdx = (r - 1) * cols + col;
          candidate[topIdx] = (candidate[topIdx] + 2) % 3;
        }
        if (r + 1 < rows) {
          const bottomIdx = (r + 1) * cols + col;
          candidate[bottomIdx] = (candidate[bottomIdx] + 2) % 3;
        }
      }

      const verified = applyTap(candidate, rows, cols, r, c);
      if (encodeBoard(verified) === encodeBoard(targetBoard)) {
        const key = encodeBoard(candidate);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          predecessors.push({
            board: candidate,
            key,
            tapMove: { row: r, col: c, index: idx },
          });
        }
      }
    }
  }

  return predecessors;
}

/**
 * Runs a Reverse Breadth-First Search starting from the solved board (all 0s).
 * For every reachable board, records:
 * - `par`: exact minimum number of legal forward taps needed to reach solved
 * - `nextMove`: optimal { row, col, index } tap from this board toward solved
 */
export function buildReverseSolutionTable(rows, cols, maxDepth = Infinity) {
  const solved = createSolvedBoard(rows, cols);
  const solvedKey = encodeBoard(solved);

  const table = new Map();
  table.set(solvedKey, {
    board: solved,
    par: 0,
    nextMove: null,
  });

  const queue = [solvedKey];
  let head = 0;

  while (head < queue.length) {
    const currentKey = queue[head++];
    const currentEntry = table.get(currentKey);

    if (currentEntry.par >= maxDepth) continue;

    const currentBoard = currentEntry.board;
    const nextPar = currentEntry.par + 1;
    const predecessors = getReversePredecessors(currentBoard, rows, cols);

    for (const pred of predecessors) {
      if (!table.has(pred.key)) {
        table.set(pred.key, {
          board: pred.board,
          par: nextPar,
          nextMove: pred.tapMove,
        });
        queue.push(pred.key);
      }
    }
  }

  return table;
}

/**
 * Extracts one optimal solution move sequence [{ row, col, index }, ...] for a board.
 */
export function getOptimalSolution(board, rows, cols, solutionTable) {
  const moves = [];
  let current = board.slice();
  const visitedKeys = new Set();

  while (!isBoardSolved(current)) {
    const currentKey = encodeBoard(current);
    if (visitedKeys.has(currentKey)) {
      return null;
    }
    visitedKeys.add(currentKey);

    const entry = solutionTable.get(currentKey);
    if (!entry || entry.par <= 0 || !entry.nextMove) {
      return null;
    }

    const { row, col } = entry.nextMove;
    const nextBoard = applyTap(current, rows, cols, row, col);
    const nextKey = encodeBoard(nextBoard);
    const nextEntry = solutionTable.get(nextKey);

    if (!nextEntry || nextEntry.par !== entry.par - 1) {
      return null;
    }

    moves.push(entry.nextMove);
    current = nextBoard;
  }

  return moves;
}

/**
 * Picks a puzzle board matching a target minimum move count (`par`),
 * with optional filtering to avoid trivial/boring boards when desired.
 */
export function generatePuzzle(rows, cols, targetPar, solutionTable, options = {}) {
  const { avoidSingleActiveTile = false, rng = Math.random } = options;
  const candidates = [];

  for (const [key, entry] of solutionTable.entries()) {
    if (entry.par !== targetPar) continue;

    if (avoidSingleActiveTile) {
      const nonZeroCount = entry.board.filter((v) => v !== TILE_STATE.SAND).length;
      if (nonZeroCount <= 1) continue;
    }

    candidates.push({
      key,
      board: entry.board.slice(),
      par: entry.par,
      rows,
      cols,
    });
  }

  if (candidates.length === 0) {
    throw new Error(`No puzzles found for ${rows}x${cols} with par=${targetPar}`);
  }

  const pick = Math.floor(rng() * candidates.length);
  return candidates[pick];
}
