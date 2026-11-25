import { applyMove, generateLegalMoves, isInCheck, opponentOf } from './shogi';
import {
  EngineEvaluation,
  HAND_ORDER,
  PieceType,
  ShogiMove,
  ShogiPosition,
} from './types';

const BOARD_VALUE: Record<PieceType, number> = {
  K: 20000,
  R: 1000,
  B: 860,
  G: 560,
  S: 500,
  N: 360,
  L: 340,
  P: 100,
  '+R': 1380,
  '+B': 1180,
  '+S': 580,
  '+N': 550,
  '+L': 540,
  '+P': 530,
};

const HAND_VALUE: Record<Exclude<PieceType, 'K' | '+R' | '+B' | '+S' | '+N' | '+L' | '+P'>, number> = {
  R: 1120,
  B: 960,
  G: 610,
  S: 540,
  N: 400,
  L: 370,
  P: 115,
};

// Simple advancement & centralization positional bonus (from Sente perspective)
function positionalScore(type: PieceType, row: number, col: number): number {
  const centerBonus = (4 - Math.abs(4 - col)) * 4;
  switch (type) {
    case 'P':
      return (8 - row) * 6 + centerBonus;
    case 'S':
    case 'G':
      return (8 - row) * 4 + centerBonus;
    case '+P':
    case '+S':
    case '+N':
    case '+L':
      return (8 - row) * 8 + centerBonus * 2;
    case 'R':
    case '+R':
      return (8 - row) * 5 + centerBonus;
    case 'B':
    case '+B':
      return centerBonus * 3;
    case 'K':
      // Encourage King toward back ranks (castling safety)
      return row >= 7 ? 35 + Math.abs(4 - col) * 8 : -25;
    default:
      return centerBonus;
  }
}

export function evaluatePosition(pos: ShogiPosition): number {
  let score = 0;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = pos.board[r][c];
      if (!cell) continue;
      if (cell.side === 'b') {
        score += BOARD_VALUE[cell.type] + positionalScore(cell.type, r, c);
      } else {
        score -= BOARD_VALUE[cell.type] + positionalScore(cell.type, 8 - r, 8 - c);
      }
    }
  }

  for (const p of HAND_ORDER) {
    score += pos.hands.b[p] * HAND_VALUE[p];
    score -= pos.hands.w[p] * HAND_VALUE[p];
  }

  // Small tempo bonus
  score += pos.turn === 'b' ? 18 : -18;
  return score;
}

function scoreMoveOrdering(move: ShogiMove): number {
  let s = 0;
  if (move.captured) {
    s += 1000 + BOARD_VALUE[move.captured] - Math.floor(BOARD_VALUE[move.piece] / 10);
  }
  if (move.promote) s += 450;
  if (move.drop) s += 120;
  // Center preference
  s += 20 - (Math.abs(4 - move.to.col) + Math.abs(4 - move.to.row));
  return s;
}

function orderMoves(moves: ShogiMove[]): ShogiMove[] {
  return [...moves].sort((a, b) => scoreMoveOrdering(b) - scoreMoveOrdering(a));
}

interface SearchContext {
  nodes: number;
  deadline: number;
  aborted: boolean;
}

function negamax(
  pos: ShogiPosition,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  ctx: SearchContext,
): { score: number; pv: string[] } {
  ctx.nodes++;
  if ((ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) {
    ctx.aborted = true;
    return { score: 0, pv: [] };
  }

  const moves = generateLegalMoves(pos);
  if (moves.length === 0) {
    // No legal moves in Shogi = loss for side to move
    return { score: -19000 + ply, pv: [] };
  }

  if (depth <= 0) {
    // Simple 1-ply capture quiescence check
    const raw = evaluatePosition(pos);
    const signed = pos.turn === 'b' ? raw : -raw;
    return { score: signed, pv: [] };
  }

  const ordered = orderMoves(moves);
  let bestScore = -Infinity;
  let bestPv: string[] = [];

  for (const move of ordered) {
    const next = applyMove(pos, move);
    const res = negamax(next, depth - 1, -beta, -alpha, ply + 1, ctx);
    if (ctx.aborted) return { score: 0, pv: [] };
    const val = -res.score;
    if (val > bestScore) {
      bestScore = val;
      bestPv = [move.usi, ...res.pv];
    }
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }

  return { score: bestScore, pv: bestPv };
}

/**
 * Iterative deepening alpha-beta search with optional noise for lower Elo levels.
 */
export function searchBestMove(
  pos: ShogiPosition,
  options: { maxDepth?: number; timeLimitMs?: number; elo?: number } = {},
): EngineEvaluation {
  const maxDepth = options.maxDepth ?? 3;
  const timeLimitMs = options.timeLimitMs ?? 600;
  const elo = options.elo ?? 1600;

  const legal = orderMoves(generateLegalMoves(pos));
  if (legal.length === 0) {
    const check = isInCheck(pos, pos.turn);
    const losingScore = pos.turn === 'b' ? -19000 : 19000;
    return {
      scoreCp: check ? losingScore : 0,
      mateIn: pos.turn === 'b' ? -1 : 1,
      pv: [],
      depth: 0,
      nodes: 1,
    };
  }

  // Very low Elo: occasional randomized blunder / sub-optimal move among top candidates
  if (elo <= 750 && Math.random() < 0.35) {
    const pool = legal.slice(0, Math.min(8, legal.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const raw = evaluatePosition(pos);
    return {
      scoreCp: raw,
      bestMove: pick,
      pv: [pick.usi],
      depth: 1,
      nodes: legal.length,
    };
  }

  const ctx: SearchContext = {
    nodes: 0,
    deadline: performance.now() + timeLimitMs,
    aborted: false,
  };

  let bestMove = legal[0];
  let bestScoreFromTurn = 0;
  let bestPv: string[] = [legal[0].usi];
  let reachedDepth = 1;

  for (let d = 1; d <= maxDepth; d++) {
    let alpha = -Infinity;
    const beta = Infinity;
    let curBestMove = bestMove;
    let curBestScore = -Infinity;
    let curBestPv: string[] = [];

    for (const move of legal) {
      const next = applyMove(pos, move);
      const res = negamax(next, d - 1, -beta, -alpha, 1, ctx);
      if (ctx.aborted) break;
      const val = -res.score;
      if (val > curBestScore) {
        curBestScore = val;
        curBestMove = move;
        curBestPv = [move.usi, ...res.pv];
      }
      if (val > alpha) alpha = val;
    }

    if (ctx.aborted) break;
    bestMove = curBestMove;
    bestScoreFromTurn = curBestScore;
    bestPv = curBestPv;
    reachedDepth = d;
    if (Math.abs(curBestScore) > 18000) break;
  }

  // Convert score to Sente ('b') perspective
  const scoreCp = pos.turn === 'b' ? bestScoreFromTurn : -bestScoreFromTurn;
  let mateIn: number | undefined;
  if (Math.abs(scoreCp) > 18000) {
    const plies = Math.max(1, 19000 - Math.abs(scoreCp));
    const movesToMate = Math.ceil(plies / 2);
    mateIn = scoreCp > 0 ? movesToMate : -movesToMate;
  }

  return {
    scoreCp,
    mateIn,
    bestMove,
    pv: bestPv,
    depth: reachedDepth,
    nodes: ctx.nodes,
  };
}

export function classifyMoveDelta(
  prevEvalCp: number,
  nextEvalCp: number,
  moverSide: 'b' | 'w',
): 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' {
  const loss =
    moverSide === 'b' ? prevEvalCp - nextEvalCp : nextEvalCp - prevEvalCp;
  if (loss <= 25) return 'best';
  if (loss <= 80) return 'good';
  if (loss <= 160) return 'inaccuracy';
  if (loss <= 300) return 'mistake';
  return 'blunder';
}

export { opponentOf };
