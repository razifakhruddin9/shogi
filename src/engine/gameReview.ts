import { SHOGI_REPERTOIRE } from '../data/repertoire';
import { searchBestMove } from './ai';
import { parseSfen } from './sfen';
import { applyMove, findLegalMoveByUsi, getMaterialBalance } from './shogi';
import { ShogiMove, ShogiPosition, Side } from './types';

export type ReviewMoveCategory =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'book'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface CategoryMeta {
  id: ReviewMoveCategory;
  label: string;
  symbol: string;
  color: string;
}

export const REVIEW_CATEGORIES: CategoryMeta[] = [
  { id: 'brilliant', label: 'Brilian', symbol: '!!', color: '#26C2A3' },
  { id: 'great', label: 'Sangat Baik', symbol: '!', color: '#4DA3F7' },
  { id: 'best', label: 'Bagus', symbol: '★', color: '#3FBF8A' },
  { id: 'good', label: 'Baik', symbol: '✓', color: '#7BB686' },
  { id: 'book', label: 'Buku', symbol: '📖', color: '#C48A5A' },
  { id: 'inaccuracy', label: 'Tidak Akurat', symbol: '?!', color: '#E0A62F' },
  { id: 'mistake', label: 'Kesalahan', symbol: '?', color: '#E67E22' },
  { id: 'miss', label: 'Terlewat', symbol: '✕', color: '#E2745D' },
  { id: 'blunder', label: 'Blunder', symbol: '??', color: '#E5483A' },
];

export const CATEGORY_MAP: Record<ReviewMoveCategory, CategoryMeta> =
  Object.fromEntries(REVIEW_CATEGORIES.map((c) => [c.id, c])) as Record<
    ReviewMoveCategory,
    CategoryMeta
  >;

export interface ReviewedPly {
  ply: number;
  mover?: Side;
  usi?: string;
  kifu?: string;
  scoreCp: number; // Sente perspective
  mateIn?: number; // Sente perspective
  bestMoveUsi?: string;
  cpLoss: number;
  category: ReviewMoveCategory;
}

export interface PhaseSkill {
  opening: number; // 0..100
  middlegame: number; // 0..100
  endgame: number; // 0..100
  estimatedElo: number;
  tierLabel: string;
}

export interface FullGameReview {
  engineLabel: string;
  senteAccuracy: number;
  goteAccuracy: number;
  senteCounts: Record<ReviewMoveCategory, number>;
  goteCounts: Record<ReviewMoveCategory, number>;
  senteSkill: PhaseSkill;
  goteSkill: PhaseSkill;
  plies: ReviewedPly[];
}

function emptyCounts(): Record<ReviewMoveCategory, number> {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  };
}

function isBookOpeningMove(prefixMovesUsi: string[], initialSfen: string): boolean {
  if (!initialSfen.startsWith('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL')) {
    return false;
  }
  return SHOGI_REPERTOIRE.some((line) => {
    if (line.phase !== 'joban') return false;
    if (prefixMovesUsi.length > line.movesUsi.length) return false;
    return prefixMovesUsi.every((u, idx) => line.movesUsi[idx] === u);
  });
}

export function classifySinglePly(params: {
  ply: number;
  mover: Side;
  playedUsi: string;
  bestMoveUsi?: string;
  prevScoreCp: number;
  curScoreCp: number;
  prevMateIn?: number;
  curMateIn?: number;
  prevPos: ShogiPosition;
  curPos: ShogiPosition;
  prefixMovesUsi: string[];
  initialSfen: string;
}): { cpLoss: number; category: ReviewMoveCategory } {
  const {
    mover,
    playedUsi,
    bestMoveUsi,
    prevScoreCp,
    curScoreCp,
    prevMateIn,
    curMateIn,
    prevPos,
    curPos,
    prefixMovesUsi,
    initialSfen,
  } = params;

  if (isBookOpeningMove(prefixMovesUsi, initialSfen)) {
    return { cpLoss: 0, category: 'book' };
  }

  const loss =
    mover === 'b'
      ? Math.max(0, prevScoreCp - curScoreCp)
      : Math.max(0, curScoreCp - prevScoreCp);

  const isExactBest = Boolean(bestMoveUsi && playedUsi === bestMoveUsi);

  // Check if a huge winning opportunity / mate was missed ("Terlewat")
  const prevWinningForMover =
    (mover === 'b' && (prevScoreCp >= 350 || (prevMateIn ?? 0) > 0)) ||
    (mover === 'w' && (prevScoreCp <= -350 || (prevMateIn ?? 0) < 0));
  const curStillWinningForMover =
    (mover === 'b' && (curScoreCp >= 220 || (curMateIn ?? 0) > 0)) ||
    (mover === 'w' && (curScoreCp <= -220 || (curMateIn ?? 0) < 0));

  if (prevWinningForMover && !curStillWinningForMover && loss >= 200 && loss < 450) {
    return { cpLoss: loss, category: 'miss' };
  }

  // Detect Brilliant: exact best move (or <=15cp loss) that sacrifices material yet keeps/increases strong advantage
  const prevMat = getMaterialBalance(prevPos);
  const curMat = getMaterialBalance(curPos);
  const matDeltaForMover =
    mover === 'b' ? curMat.diff - prevMat.diff : prevMat.diff - curMat.diff;
  const evalAfterForMover = mover === 'b' ? curScoreCp : -curScoreCp;

  if (
    (isExactBest || loss <= 15) &&
    matDeltaForMover <= -2 &&
    evalAfterForMover >= 120 &&
    params.ply >= 8
  ) {
    return { cpLoss: loss, category: 'brilliant' };
  }

  // Detect Great ("Sangat Baik"): exact best move that swings out of tension or maintains critical lead
  const evalBeforeForMover = mover === 'b' ? prevScoreCp : -prevScoreCp;
  if (
    isExactBest &&
    evalBeforeForMover >= -120 &&
    evalAfterForMover - evalBeforeForMover >= 80 &&
    params.ply >= 6
  ) {
    return { cpLoss: loss, category: 'great' };
  }

  if (isExactBest || loss <= 20) return { cpLoss: loss, category: 'best' };
  if (loss <= 65) return { cpLoss: loss, category: 'good' };
  if (loss <= 150) return { cpLoss: loss, category: 'inaccuracy' };
  if (loss <= 310) return { cpLoss: loss, category: 'mistake' };
  return { cpLoss: loss, category: 'blunder' };
}

function lossesToAccuracy(losses: number[]): number {
  if (losses.length === 0) return 100;
  const avg = losses.reduce((a, b) => a + b, 0) / losses.length;
  // Smooth chess.com-like accuracy curve from 0 to 100
  const raw = 103.5 * Math.exp(-0.0038 * avg);
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

function computeSkillProfile(
  sidePlies: { ply: number; cpLoss: number }[],
  overallAccuracy: number,
  opponentElo: number,
): PhaseSkill {
  const openingLosses = sidePlies.filter((p) => p.ply <= 16).map((p) => p.cpLoss);
  const midLosses = sidePlies
    .filter((p) => p.ply > 16 && p.ply <= 46)
    .map((p) => p.cpLoss);
  const endLosses = sidePlies.filter((p) => p.ply > 46).map((p) => p.cpLoss);

  const opening = openingLosses.length
    ? lossesToAccuracy(openingLosses)
    : overallAccuracy;
  const middlegame = midLosses.length ? lossesToAccuracy(midLosses) : overallAccuracy;
  const endgame = endLosses.length ? lossesToAccuracy(endLosses) : overallAccuracy;

  const cappedOpp = Math.min(2400, Math.max(800, opponentElo || 1500));
  const rawPerf =
    350 + Math.pow(overallAccuracy / 100, 1.35) * (cappedOpp * 0.8 + 400);
  const estimatedElo = Math.max(
    400,
    Math.min(2950, Math.round(rawPerf / 10) * 10),
  );

  const tierLabel =
    overallAccuracy >= 90
      ? 'Master / Dan'
      : overallAccuracy >= 80
        ? 'Taktis Kuat'
        : overallAccuracy >= 68
          ? 'Klub Menengah'
          : overallAccuracy >= 52
            ? 'Berkembang'
            : 'Pemula';

  return { opening, middlegame, endgame, estimatedElo, tierLabel };
}

export async function generateFullGameReview(params: {
  initialSfen: string;
  moves: ShogiMove[];
  positions: ShogiPosition[];
  usiReady: boolean;
  senteElo?: number;
  goteElo?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<FullGameReview> {
  const { initialSfen, moves, positions, usiReady, senteElo = 1580, goteElo = 1580, onProgress } = params;
  const movesUsi = moves.map((m) => m.usi);
  const initialTurn: Side = positions[0]?.turn ?? 'b';

  let rawEvalPlies: {
    ply: number;
    scoreCp: number;
    mateIn?: number;
    bestMoveUsi?: string;
  }[] = [];
  let engineLabel = 'Browser Search Engine';

  if (usiReady) {
    try {
      onProgress?.(1, Math.max(1, moves.length));
      const res = await fetch('/api/usi/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialSfen,
          movesUsi,
          movetimeMs: 120,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          engineName: string;
          evalName: string;
          plies: {
            ply: number;
            scoreCp: number;
            mateIn?: number;
            bestMoveUsi?: string;
          }[];
        };
        rawEvalPlies = data.plies;
        engineLabel = `${data.engineName} • ${data.evalName}`;
      }
    } catch {
      rawEvalPlies = [];
    }
  }

  // Browser fallback if USI server is offline or failed
  if (rawEvalPlies.length === 0) {
    let simPos = positions[0] ?? parseSfen(initialSfen);
    for (let ply = 0; ply <= moves.length; ply++) {
      onProgress?.(ply + 1, moves.length + 1);
      // Yield to event loop so animations/UI stay responsive
      await new Promise((r) => setTimeout(r, 0));
      const evalRes = searchBestMove(simPos, {
        maxDepth: 2,
        timeLimitMs: 110,
        elo: 1950,
      });
      rawEvalPlies.push({
        ply,
        scoreCp: evalRes.scoreCp,
        mateIn: evalRes.mateIn,
        bestMoveUsi: evalRes.bestMove?.usi,
      });
      if (ply < moves.length) {
        const mv = moves[ply] ?? findLegalMoveByUsi(simPos, movesUsi[ply]);
        if (!mv) break;
        simPos = applyMove(simPos, mv);
      }
    }
  }

  const senteCounts = emptyCounts();
  const goteCounts = emptyCounts();
  const senteLosses: { ply: number; cpLoss: number }[] = [];
  const goteLosses: { ply: number; cpLoss: number }[] = [];
  const reviewedPlies: ReviewedPly[] = [];

  for (let i = 0; i < rawEvalPlies.length; i++) {
    const cur = rawEvalPlies[i];
    if (i === 0) {
      reviewedPlies.push({
        ply: 0,
        scoreCp: cur.scoreCp,
        mateIn: cur.mateIn,
        bestMoveUsi: cur.bestMoveUsi,
        cpLoss: 0,
        category: 'book',
      });
      continue;
    }

    const prev = rawEvalPlies[i - 1];
    const moveObj = moves[i - 1];
    const mover: Side =
      (i - 1) % 2 === 0 ? initialTurn : initialTurn === 'b' ? 'w' : 'b';

    const { cpLoss, category } = classifySinglePly({
      ply: i,
      mover,
      playedUsi: moveObj.usi,
      bestMoveUsi: prev.bestMoveUsi,
      prevScoreCp: prev.scoreCp,
      curScoreCp: cur.scoreCp,
      prevMateIn: prev.mateIn,
      curMateIn: cur.mateIn,
      prevPos: positions[i - 1],
      curPos: positions[i],
      prefixMovesUsi: movesUsi.slice(0, i),
      initialSfen,
    });

    if (mover === 'b') {
      senteCounts[category]++;
      senteLosses.push({ ply: i, cpLoss });
    } else {
      goteCounts[category]++;
      goteLosses.push({ ply: i, cpLoss });
    }

    reviewedPlies.push({
      ply: i,
      mover,
      usi: moveObj.usi,
      kifu: moveObj.kifu,
      scoreCp: cur.scoreCp,
      mateIn: cur.mateIn,
      bestMoveUsi: prev.bestMoveUsi,
      cpLoss,
      category,
    });
  }

  const senteAccuracy = lossesToAccuracy(senteLosses.map((x) => x.cpLoss));
  const goteAccuracy = lossesToAccuracy(goteLosses.map((x) => x.cpLoss));

  return {
    engineLabel,
    senteAccuracy,
    goteAccuracy,
    senteCounts,
    goteCounts,
    senteSkill: computeSkillProfile(senteLosses, senteAccuracy, goteElo),
    goteSkill: computeSkillProfile(goteLosses, goteAccuracy, senteElo),
    plies: reviewedPlies,
  };
}
