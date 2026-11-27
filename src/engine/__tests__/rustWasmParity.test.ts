import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePosition, searchBestMove } from '../ai';
import {
  initRustCore,
  rustEvaluatePosition,
  rustGenerateLegalMoves,
  rustGetMaterialBalance,
  rustParseSfen,
  rustSearchBestMove,
  rustToSfen,
} from '../rustBridge';
import { parseSfen, toSfen } from '../sfen';
import { generateLegalMoves, getMaterialBalance } from '../shogi';
import { INITIAL_SFEN } from '../types';

const WASM_PATH = path.resolve(
  process.cwd(),
  'src/engine/wasm/shogi_core_bg.wasm',
);

describe('Rust/WASM Bridge Parity Verification', () => {
  it('loads compiled shogi_core_bg.wasm and matches TypeScript engine exactly', async () => {
    const wasmBytes = fs.readFileSync(WASM_PATH);
    const loaded = await initRustCore(wasmBytes);
    expect(loaded).toBe(true);

    // 1. SFEN roundtrip parity
    const rustPos = rustParseSfen(INITIAL_SFEN);
    const tsPos = parseSfen(INITIAL_SFEN);
    expect(rustPos).toEqual(tsPos);
    expect(rustToSfen(rustPos)).toBe(toSfen(tsPos));

    // 2. Legal moves + notation + material + static evaluation parity
    const testSfens = [
      INITIAL_SFEN,
      '4k4/9/4P4/9/9/9/9/9/4K4 b G 1',
      '3lkl3/9/4G4/9/9/9/9/9/4K4 b P 1',
      '4k4/9/9/4+P4/9/9/9/9/4K4 b P 1',
      '8k/5R2l/6S2/9/9/9/9/9/4K4 b G 1',
    ];

    for (const sfen of testSfens) {
      const pos = parseSfen(sfen);
      expect(rustGenerateLegalMoves(pos)).toEqual(generateLegalMoves(pos));
      expect(rustGetMaterialBalance(pos)).toEqual(getMaterialBalance(pos));
      expect(rustEvaluatePosition(pos)).toBe(evaluatePosition(pos));
    }

    // 3. Search parity on mate-in-1 and opening depth 2
    const matePos = parseSfen('4k4/9/4P4/9/9/9/9/9/4K4 b G 1');
    const rustMate = rustSearchBestMove(matePos, { maxDepth: 2, timeLimitMs: 1000, elo: 2000 });
    const tsMate = searchBestMove(matePos, { maxDepth: 2, timeLimitMs: 1000, elo: 2000 });
    expect(rustMate.bestMove?.usi).toBe('G*5b');
    expect(rustMate.bestMove?.usi).toBe(tsMate.bestMove?.usi);
    expect(rustMate.mateIn).toBe(tsMate.mateIn);

    const openPos = parseSfen(INITIAL_SFEN);
    const rustOpen = rustSearchBestMove(openPos, { maxDepth: 2, timeLimitMs: 1500, elo: 2000 });
    const tsOpen = searchBestMove(openPos, { maxDepth: 2, timeLimitMs: 1500, elo: 2000 });
    expect(rustOpen.bestMove?.usi).toBe(tsOpen.bestMove?.usi);
    expect(rustOpen.scoreCp).toBe(tsOpen.scoreCp);
  });
});
