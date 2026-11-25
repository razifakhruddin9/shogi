import { findLegalMoveByUsi } from './shogi';
import { EngineEvaluation, ShogiPosition, Side } from './types';

export interface UsiBridgeStatus {
  ready: boolean;
  engineName: string;
  evalName: string;
  evalFilePresent: boolean;
  exePresent: boolean;
}

export interface UsiMultiPvLine {
  multipv: number;
  depth: number;
  seldepth: number;
  scoreCp: number; // Sente perspective
  mateIn?: number; // Sente perspective
  pv: string[];
}

export interface UsiAnalysisResult extends EngineEvaluation {
  engineName: string;
  evalName: string;
  seldepth: number;
  nps: number;
  multiPvLines: UsiMultiPvLine[];
}

export type MoveClassification =
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export interface GameReviewPly {
  ply: number;
  scoreCp: number;
  mateIn?: number;
  bestMoveUsi?: string;
  cpLoss: number;
  classification: MoveClassification;
}

export interface GameReviewSummary {
  engineName: string;
  evalName: string;
  senteAccuracy: number;
  goteAccuracy: number;
  plies: GameReviewPly[];
}

export async function fetchUsiStatus(): Promise<UsiBridgeStatus | null> {
  try {
    const res = await fetch('/api/usi/status');
    if (!res.ok) return null;
    return (await res.json()) as UsiBridgeStatus;
  } catch {
    return null;
  }
}

export async function analyzeWithYaneuraOu(
  pos: ShogiPosition,
  sfen: string,
  options: { movetimeMs?: number; multiPv?: number; depth?: number } = {},
): Promise<UsiAnalysisResult | null> {
  try {
    const res = await fetch('/api/usi/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sfen,
        movetimeMs: options.movetimeMs ?? 450,
        multiPv: options.multiPv ?? 3,
        depth: options.depth,
      }),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      engineName: string;
      evalName: string;
      depth: number;
      seldepth: number;
      nodes: number;
      nps: number;
      scoreCpFromTurn: number;
      mateInFromTurn?: number;
      bestMoveUsi?: string;
      pv: string[];
      multiPvLines: {
        multipv: number;
        depth: number;
        seldepth: number;
        scoreCp: number;
        mateIn?: number;
        pv: string[];
      }[];
    };

    const sign = pos.turn === 'b' ? 1 : -1;
    const scoreCp = raw.scoreCpFromTurn * sign;
    const mateIn =
      raw.mateInFromTurn !== undefined ? raw.mateInFromTurn * sign : undefined;
    const bestMove = raw.bestMoveUsi
      ? findLegalMoveByUsi(pos, raw.bestMoveUsi)
      : undefined;

    return {
      engineName: raw.engineName,
      evalName: raw.evalName,
      scoreCp,
      mateIn,
      bestMove,
      pv: raw.pv,
      depth: raw.depth,
      seldepth: raw.seldepth,
      nodes: raw.nodes,
      nps: raw.nps,
      multiPvLines: raw.multiPvLines.map((line) => ({
        multipv: line.multipv,
        depth: line.depth,
        seldepth: line.seldepth,
        scoreCp: line.scoreCp * sign,
        mateIn: line.mateIn !== undefined ? line.mateIn * sign : undefined,
        pv: line.pv,
      })),
    };
  } catch {
    return null;
  }
}

function classifyLoss(cpLoss: number): MoveClassification {
  if (cpLoss <= 25) return 'best';
  if (cpLoss <= 75) return 'good';
  if (cpLoss <= 160) return 'inaccuracy';
  if (cpLoss <= 320) return 'mistake';
  return 'blunder';
}

function cpLossToAccuracy(losses: number[]): number {
  if (losses.length === 0) return 100;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  const acc = Math.max(15, Math.min(99.5, 100 - avgLoss * 0.14));
  return Math.round(acc * 10) / 10;
}

export async function runFullGameReview(
  initialSfen: string,
  movesUsi: string[],
  initialTurn: Side = 'b',
): Promise<GameReviewSummary | null> {
  try {
    const res = await fetch('/api/usi/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initialSfen,
        movesUsi,
        movetimeMs: 130,
      }),
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      engineName: string;
      evalName: string;
      plies: {
        ply: number;
        turn: Side;
        scoreCp: number;
        mateIn?: number;
        bestMoveUsi?: string;
      }[];
    };

    const senteLosses: number[] = [];
    const goteLosses: number[] = [];
    const reviewed: GameReviewPly[] = [];

    for (let i = 0; i < raw.plies.length; i++) {
      const cur = raw.plies[i];
      if (i === 0) {
        reviewed.push({
          ply: 0,
          scoreCp: cur.scoreCp,
          mateIn: cur.mateIn,
          bestMoveUsi: cur.bestMoveUsi,
          cpLoss: 0,
          classification: 'best',
        });
        continue;
      }

      const prev = raw.plies[i - 1];
      const mover: Side =
        (i - 1) % 2 === 0 ? initialTurn : initialTurn === 'b' ? 'w' : 'b';
      const loss =
        mover === 'b'
          ? Math.max(0, prev.scoreCp - cur.scoreCp)
          : Math.max(0, cur.scoreCp - prev.scoreCp);

      if (mover === 'b') senteLosses.push(loss);
      else goteLosses.push(loss);

      const playedUsi = movesUsi[i - 1];
      const isEngineBest = prev.bestMoveUsi && playedUsi === prev.bestMoveUsi;
      const classification = isEngineBest ? 'best' : classifyLoss(loss);

      reviewed.push({
        ply: cur.ply,
        scoreCp: cur.scoreCp,
        mateIn: cur.mateIn,
        bestMoveUsi: cur.bestMoveUsi,
        cpLoss: loss,
        classification,
      });
    }

    return {
      engineName: raw.engineName,
      evalName: raw.evalName,
      senteAccuracy: cpLossToAccuracy(senteLosses),
      goteAccuracy: cpLossToAccuracy(goteLosses),
      plies: reviewed,
    };
  } catch {
    return null;
  }
}
