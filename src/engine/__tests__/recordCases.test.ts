import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHOGI_PUZZLES } from '../../data/puzzles';
import { SHOGI_REPERTOIRE } from '../../data/repertoire';
import { classifyMoveDelta, evaluatePosition, searchBestMove } from '../ai';
import { parseSfen, positionRepetitionKey, toSfen } from '../sfen';
import {
  applyMove,
  findLegalMoveByUsi,
  generateLegalMoves,
  getMaterialBalance,
  isInCheck,
} from '../shogi';
import { INITIAL_SFEN, Side } from '../types';

const CASES_PATH = path.resolve(process.cwd(), 'rust/shogi-core/cases.jsonl');

function buildGroundTruthCases(): string[] {
  const lines: string[] = [];
  const push = (obj: Record<string, unknown>) => lines.push(JSON.stringify(obj));

  // 1. SFEN valid & invalid roundtrips (rust-anything requires recording error paths!)
  const sfenInputs = [
    INITIAL_SFEN,
    '4k4/9/4P4/9/9/9/9/9/4K4 b G 1',
    '8k/5R2l/6S2/9/9/9/9/9/4K4 b G 1',
    '3lkl3/9/4G4/9/9/9/9/9/4K4 b P 1',
    '4k4/9/9/4+P4/9/9/9/9/4K4 b P 1',
    '1ng5k/9/1GS1GPPPP/9/9/9/9/9/4K4 b 4LNG 1',
    'lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w 2R3p 12',
    'invalid',
    '9/9/9 b - 1',
    '9/9/9/9/9/9/9/9/9 b K 1',
    '9/9/9/9/9/9/9/9/8+ b - 1',
    '9/9/9/9/9/9/9/9/8X b - 1',
  ];

  for (const sfen of sfenInputs) {
    try {
      const pos = parseSfen(sfen);
      push({
        fn_name: 'sfen_roundtrip',
        sfen,
        expected: {
          ok: true,
          sfen: toSfen(pos, true),
          repKey: positionRepetitionKey(pos),
        },
      });
    } catch {
      push({
        fn_name: 'sfen_roundtrip',
        sfen,
        expected: { ok: false },
      });
    }
  }

  // 2. Legal move generation, check status, material balance, static eval across diverse positions
  const legalMoveSfens = [
    INITIAL_SFEN,
    '4k4/9/9/9/9/9/4P4/9/4K4 b P 1', // Nifu
    '4k4/9/9/4+P4/9/9/9/9/4K4 b P 1', // Tokin Nifu exception
    '3lkl3/9/4G4/9/9/9/9/9/4K4 b P 1', // Uchifuzume
    '4k4/9/4P4/9/9/9/9/9/4K4 b G 1', // Atamakin
    '4k4/P8/9/9/9/9/9/9/4K4 b - 1', // Forced pawn promotion
    '4k4/9/N8/9/9/9/9/9/4K4 b - 1', // Forced knight promotion
    'lnsgkgsnl/1r5b1/p1ppppppp/1p7/9/7P1/PPPPPPP1P/1B5R1/LNSGKGSNL b - 3',
    ...SHOGI_PUZZLES.map((p) => p.sfen),
  ];

  for (const sfen of legalMoveSfens) {
    const pos = parseSfen(sfen);
    const moves = generateLegalMoves(pos);
    push({
      fn_name: 'legal_moves',
      sfen,
      expected: {
        count: moves.length,
        inCheck: isInCheck(pos, pos.turn),
        material: getMaterialBalance(pos),
        evalCp: evaluatePosition(pos),
        moves: moves.map((m) => [m.usi, m.kifu, m.western]),
      },
    });
  }

  // 3. Apply move sequences from all Tsume puzzles & Repertoire lines
  for (const p of SHOGI_PUZZLES) {
    let cur = parseSfen(p.sfen);
    for (const usi of p.solutionUsi) {
      const curSfen = toSfen(cur, true);
      const mv = findLegalMoveByUsi(cur, usi)!;
      const next = applyMove(cur, mv);
      push({
        fn_name: 'apply_usi',
        sfen: curSfen,
        usi,
        expected: {
          nextSfen: toSfen(next, true),
          inCheck: isInCheck(next, next.turn),
          kifu: mv.kifu,
          western: mv.western,
        },
      });
      cur = next;
    }
  }

  for (const line of SHOGI_REPERTOIRE.slice(0, 5)) {
    let cur = parseSfen(line.initialSfen);
    for (const usi of line.movesUsi) {
      const curSfen = toSfen(cur, true);
      const mv = findLegalMoveByUsi(cur, usi)!;
      const next = applyMove(cur, mv);
      push({
        fn_name: 'apply_usi',
        sfen: curSfen,
        usi,
        expected: {
          nextSfen: toSfen(next, true),
          inCheck: isInCheck(next, next.turn),
          kifu: mv.kifu,
          western: mv.western,
        },
      });
      cur = next;
    }
  }

  // 4. Deterministic AI search cases (elo >= 1600 -> zero randomness, high time limit)
  const aiCases: { sfen: string; depth: number }[] = [
    { sfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1', depth: 2 },
    { sfen: '8k/5R2l/6S2/9/9/9/9/9/4K4 b G 1', depth: 2 },
    { sfen: INITIAL_SFEN, depth: 1 },
    { sfen: INITIAL_SFEN, depth: 2 },
  ];

  for (const ac of aiCases) {
    const pos = parseSfen(ac.sfen);
    const evalRes = searchBestMove(pos, {
      maxDepth: ac.depth,
      timeLimitMs: 10000,
      elo: 2000,
    });
    push({
      fn_name: 'search_best_move',
      sfen: ac.sfen,
      depth: ac.depth,
      expected: {
        bestUsi: evalRes.bestMove?.usi ?? null,
        scoreCp: evalRes.scoreCp,
        mateIn: evalRes.mateIn ?? null,
        depth: evalRes.depth,
      },
    });
  }

  // 5. classifyMoveDelta boundary cases
  const deltaCases: [number, number, Side][] = [
    [100, 100, 'b'],
    [100, 75, 'b'],
    [100, 74, 'b'],
    [100, 20, 'b'],
    [100, 19, 'b'],
    [100, -60, 'b'],
    [100, -61, 'b'],
    [100, -200, 'b'],
    [100, -201, 'b'],
    [-100, -100, 'w'],
    [-100, -50, 'w'],
    [-100, 150, 'w'],
    [-100, 250, 'w'],
  ];
  for (const [prev_cp, next_cp, side] of deltaCases) {
    push({
      fn_name: 'classify_move_delta',
      sfen: INITIAL_SFEN,
      prev_cp,
      next_cp,
      side,
      expected: classifyMoveDelta(prev_cp, next_cp, side),
    });
  }

  return lines;
}

describe('Rust Migration Ground-Truth Recording Contract', () => {
  it('records or validates rust/shogi-core/cases.jsonl against TypeScript engine', () => {
    const generated = buildGroundTruthCases();
    expect(generated.length).toBeGreaterThan(60);

    if (process.env.RECORD_CASES === '1' || !fs.existsSync(CASES_PATH)) {
      fs.mkdirSync(path.dirname(CASES_PATH), { recursive: true });
      fs.writeFileSync(CASES_PATH, `${generated.join('\n')}\n`, 'utf8');
    } else {
      const existing = fs
        .readFileSync(CASES_PATH, 'utf8')
        .trim()
        .split(/\r?\n/);
      expect(existing).toEqual(generated);
    }
  });
});
