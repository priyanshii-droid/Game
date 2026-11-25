// levels.js — Designed puzzle progression and measurable board evaluation for FLICKIEGO
import {
  TILE_STATE,
  applyTap,
  encodeBoard,
  generatePuzzle,
  getOptimalSolution,
  isBoardSolved,
} from "./engine.js";

/**
 * Returns the maximum Par present in a reverse-BFS solution table.
 */
export function getMaxParInTable(solutionTable) {
  let maxPar = 0;
  for (const entry of solutionTable.values()) {
    if (entry.par > maxPar) {
      maxPar = entry.par;
    }
  }
  return maxPar;
}

/**
 * Computes measurable structural and solution-path properties for a board.
 */
export function analyzeBoard(board, rows, cols, solutionTable) {
  let sandCount = 0;
  let terracottaCount = 0;
  let sageCount = 0;
  let activeCount = 0;
  const activeRows = new Set();
  const activeCols = new Set();

  for (let idx = 0; idx < board.length; idx++) {
    const val = board[idx];
    if (val === TILE_STATE.SAND) {
      sandCount++;
    } else {
      activeCount++;
      activeRows.add(Math.floor(idx / cols));
      activeCols.add(idx % cols);
      if (val === TILE_STATE.TERRACOTTA) terracottaCount++;
      else if (val === TILE_STATE.SAGE) sageCount++;
    }
  }

  const hasAllThreeStates = sandCount > 0 && terracottaCount > 0 && sageCount > 0;
  const hasPulseDiversity = terracottaCount > 0 && sageCount > 0;
  const rowSpread = activeRows.size;
  const colSpread = activeCols.size;

  const optimalMoves = getOptimalSolution(board, rows, cols, solutionTable) ?? [];
  const uniqueTapIndices = new Set();
  const intermediateStateKeys = new Set();
  let usedHorizontalRipple = false;
  let usedVerticalRipple = false;
  let consecutiveSameTileCount = 0;
  let prevTapIndex = -1;

  let sim = board.slice();
  for (const move of optimalMoves) {
    uniqueTapIndices.add(move.index);
    if (move.index === prevTapIndex) {
      consecutiveSameTileCount++;
    }
    prevTapIndex = move.index;

    sim = applyTap(sim, rows, cols, move.row, move.col);
    if (!isBoardSolved(sim)) {
      intermediateStateKeys.add(encodeBoard(sim));
    }

    const resultingState = sim[move.index];
    if (resultingState === TILE_STATE.TERRACOTTA) {
      usedHorizontalRipple = true;
    } else if (resultingState === TILE_STATE.SAGE) {
      usedVerticalRipple = true;
    }
  }

  const hasDualAxisSolution = usedHorizontalRipple && usedVerticalRipple;
  const uniqueTapPositions = uniqueTapIndices.size;
  const uniqueIntermediateStates = intermediateStateKeys.size;

  const qualityScore =
    (hasDualAxisSolution ? 120 : 0) +
    (hasPulseDiversity ? 40 : 0) +
    (hasAllThreeStates ? 15 : 0) +
    (rowSpread + colSpread) * 12 +
    activeCount * 8 +
    uniqueTapPositions * 15 +
    uniqueIntermediateStates * 12 -
    consecutiveSameTileCount * 20;

  return {
    sandCount,
    terracottaCount,
    sageCount,
    activeCount,
    hasAllThreeStates,
    hasPulseDiversity,
    rowSpread,
    colSpread,
    usedHorizontalRipple,
    usedVerticalRipple,
    hasDualAxisSolution,
    uniqueTapPositions,
    uniqueIntermediateStates,
    consecutiveSameTileCount,
    solutionLength: optimalMoves.length,
    qualityScore,
  };
}

/**
 * Returns the planned grid dimensions, exact Par, and pedagogical focus for a 1-based level.
 */
export function getLevelPlan(levelNumber, maxThreeByThreePar = 6) {
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    throw new RangeError(`Level number must be a positive integer, received ${levelNumber}`);
  }

  const capped3x3Max = Math.max(1, maxThreeByThreePar);

  if (levelNumber === 1) {
    return {
      level: 1,
      tier: "tutorial-intro",
      focus: "Learn the three states",
      rows: 2,
      cols: 2,
      par: 2,
    };
  }

  if (levelNumber <= 3) {
    const pars = [3, 4];
    return {
      level: levelNumber,
      tier: "tutorial-order",
      focus: "Discover interaction and order",
      rows: 2,
      cols: 2,
      par: pars[levelNumber - 2],
    };
  }

  if (levelNumber <= 6) {
    const pars = [2, 3, 3];
    return {
      level: levelNumber,
      tier: "explore-3x3",
      focus: "Explore a larger grid",
      rows: 3,
      cols: 3,
      par: Math.min(pars[levelNumber - 4], capped3x3Max),
    };
  }

  if (levelNumber <= 9) {
    const pars = [4, 4, 5];
    return {
      level: levelNumber,
      tier: "coordinate-axes",
      focus: "Coordinate both axes",
      rows: 3,
      cols: 3,
      par: Math.min(pars[levelNumber - 7], capped3x3Max),
    };
  }

  if (levelNumber <= 12) {
    const pars = [5, 6, 6];
    return {
      level: levelNumber,
      tier: "involved-planning",
      focus: "More involved planning",
      rows: 3,
      cols: 3,
      par: Math.min(pars[levelNumber - 10], capped3x3Max),
    };
  }

  return {
    level: levelNumber,
    tier: "varied-3x3",
    focus: "Varied arrangements",
    rows: 3,
    cols: 3,
    par: Math.min(6, capped3x3Max),
  };
}

function getAllCandidatesAtPar(rows, cols, targetPar, solutionTable) {
  const candidates = [];
  for (const [key, entry] of solutionTable.entries()) {
    if (entry.par !== targetPar) continue;
    candidates.push({
      key,
      board: entry.board.slice(),
      par: entry.par,
      metrics: analyzeBoard(entry.board, rows, cols, solutionTable),
    });
  }
  return candidates;
}

export function buildPreferenceTiers(candidates, plan) {
  const { level } = plan;

  if (level === 1) {
    return [
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 2 &&
          c.metrics.hasAllThreeStates &&
          c.metrics.uniqueTapPositions >= 2
      ),
      candidates.filter(
        (c) => c.metrics.activeCount >= 2 && c.metrics.uniqueTapPositions >= 2
      ),
      candidates.filter((c) => c.metrics.activeCount >= 2),
      candidates,
    ];
  }

  if (level <= 3) {
    return [
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 2 &&
          c.metrics.hasDualAxisSolution &&
          c.metrics.uniqueTapPositions >= 2
      ),
      candidates.filter(
        (c) => c.metrics.activeCount >= 2 && c.metrics.uniqueTapPositions >= 2
      ),
      candidates,
    ];
  }

  if (level <= 6) {
    return [
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 2 &&
          c.metrics.hasDualAxisSolution &&
          c.metrics.uniqueTapPositions >= 2
      ),
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 2 &&
          (c.metrics.hasPulseDiversity || c.metrics.hasDualAxisSolution)
      ),
      candidates.filter((c) => c.metrics.activeCount >= 2),
      candidates,
    ];
  }

  if (level <= 9) {
    return [
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 3 &&
          c.metrics.hasPulseDiversity &&
          c.metrics.hasDualAxisSolution &&
          c.metrics.rowSpread >= 2 &&
          c.metrics.colSpread >= 2 &&
          c.metrics.uniqueTapPositions >= 3
      ),
      candidates.filter(
        (c) =>
          c.metrics.activeCount >= 2 &&
          c.metrics.hasDualAxisSolution &&
          c.metrics.uniqueTapPositions >= 2
      ),
      candidates.filter((c) => c.metrics.activeCount >= 2),
      candidates,
    ];
  }

  return [
    candidates.filter(
      (c) =>
        c.metrics.activeCount >= 4 &&
        c.metrics.hasPulseDiversity &&
        c.metrics.hasDualAxisSolution &&
        c.metrics.rowSpread >= 2 &&
        c.metrics.colSpread >= 2 &&
        c.metrics.uniqueTapPositions >= 3 &&
        c.metrics.consecutiveSameTileCount <= 1
    ),
    candidates.filter(
      (c) =>
        c.metrics.activeCount >= 3 &&
        c.metrics.hasPulseDiversity &&
        c.metrics.hasDualAxisSolution &&
        c.metrics.uniqueTapPositions >= 3
    ),
    candidates.filter(
      (c) => c.metrics.activeCount >= 2 && c.metrics.hasDualAxisSolution
    ),
    candidates.filter((c) => c.metrics.activeCount >= 2),
    candidates,
  ];
}

function selectFromPool(pool, level, rng) {
  if (pool.length === 1) return pool[0];

  const sorted = pool.slice().sort((a, b) => b.metrics.qualityScore - a.metrics.qualityScore);
  const topSliceSize = level >= 13 ? Math.min(sorted.length, 24) : Math.min(sorted.length, 12);
  const pickIndex = Math.floor(rng() * topSliceSize);
  return sorted[pickIndex];
}

/**
 * Generates a mathematically verified, solvable puzzle for `levelNumber`.
 */
export function createLevelPuzzle(levelNumber, tablesBySize, seenKeys = new Set(), rng = Math.random) {
  const threeByThreeTable = tablesBySize.get("3x3");
  const maxThreeByThreePar = threeByThreeTable ? getMaxParInTable(threeByThreeTable) : 6;
  const plan = getLevelPlan(levelNumber, maxThreeByThreePar);
  const sizeKey = `${plan.rows}x${plan.cols}`;
  const table = tablesBySize.get(sizeKey);

  if (!table || table.size === 0) {
    throw new Error(`Missing or empty reverse-BFS solution table for ${sizeKey}`);
  }

  const maxVerifiedPar = getMaxParInTable(table);
  const targetPar = Math.min(plan.par, maxVerifiedPar);

  const allAtPar = getAllCandidatesAtPar(plan.rows, plan.cols, targetPar, table);
  const unseenAtPar = allAtPar.filter((candidate) => !seenKeys.has(candidate.key));

  if (allAtPar.length === 0) {
    const fallback = generatePuzzle(plan.rows, plan.cols, targetPar, table, {
      avoidSingleActiveTile: false,
      rng,
    });
    allAtPar.push({
      key: fallback.key,
      board: fallback.board,
      par: fallback.par,
      metrics: analyzeBoard(fallback.board, plan.rows, plan.cols, table),
    });
  }

  let poolExhausted = false;
  let usedFallbackTier = false;
  let chosen = null;

  if (unseenAtPar.length > 0) {
    const unseenTiers = buildPreferenceTiers(unseenAtPar, { ...plan, par: targetPar });
    for (let t = 0; t < unseenTiers.length; t++) {
      if (unseenTiers[t].length > 0) {
        chosen = selectFromPool(unseenTiers[t], levelNumber, rng);
        usedFallbackTier = t > 0;
        break;
      }
    }
  }

  if (!chosen) {
    poolExhausted = true;
    usedFallbackTier = true;
    const revisitTiers = buildPreferenceTiers(allAtPar, { ...plan, par: targetPar });
    for (const tierPool of revisitTiers) {
      if (tierPool.length > 0) {
        chosen = selectFromPool(tierPool, levelNumber, rng);
        break;
      }
    }
  }

  seenKeys.add(chosen.key);

  const notes = [];
  if (levelNumber >= 13) {
    notes.push(
      `Par remains ${targetPar} (verified 3x3 maximum); boards vary across dual-axis arrangements.`
    );
  }
  if (poolExhausted) {
    notes.push(
      `All ${sizeKey} boards at Par ${targetPar} have been played in this session; revisiting verified boards.`
    );
  }

  return {
    level: plan.level,
    tier: plan.tier,
    focus: plan.focus,
    rows: plan.rows,
    cols: plan.cols,
    par: chosen.par,
    initialBoard: chosen.board.slice(),
    board: chosen.board.slice(),
    moveCount: 0,
    history: [],
    isSolved: false,
    lastTapIndex: null,
    lastRippledIndices: [],
    tapSeq: 0,
    poolExhausted,
    usedFallbackTier,
    boardMetrics: chosen.metrics,
    limitationNote: notes.join(" "),
  };
}
