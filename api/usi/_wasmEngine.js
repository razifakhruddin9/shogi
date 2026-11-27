import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  initSync,
  wasm_analyze_multipv_json,
  wasm_review_game_json,
} from '../../src/engine/wasm/shogi_core.js';

export const ENGINE_NAME = 'YaneuraOu + Suisho5 (Rust/WASM)';
export const EVAL_NAME = 'Shogi Core TT+QSearch (Vercel)';

let initialized = false;

function resolveWasmPath() {
  const candidates = [
    fileURLToPath(new URL('../../src/engine/wasm/shogi_core_bg.wasm', import.meta.url)),
    path.resolve(process.cwd(), 'src/engine/wasm/shogi_core_bg.wasm'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Rust/WASM binary not found. Checked: ${candidates.join(', ')}`);
}

export function ensureWasmEngine() {
  if (initialized) return true;
  const wasmBytes = fs.readFileSync(resolveWasmPath());
  initSync({ module: wasmBytes });
  initialized = true;
  return true;
}

export function analyzeWithWasm({
  sfen = 'startpos',
  movesUsi = [],
  movetimeMs = 450,
  multiPv = 3,
  depth,
} = {}) {
  ensureWasmEngine();
  const safeMultiPv = Math.max(1, Math.min(5, Number(multiPv) || 1));
  const safeTime = Math.max(80, Math.min(4000, Number(movetimeMs) || 450));
  const targetDepth =
    depth && Number(depth) > 0
      ? Math.max(1, Math.min(6, Number(depth)))
      : safeMultiPv === 1
        ? safeTime >= 350
          ? 5
          : 4
        : safeTime >= 350
          ? 4
          : 3;
  const maxNodes = Math.max(
    25_000,
    Math.min(350_000, Math.round(safeTime * (safeMultiPv === 1 ? 360 : 320))),
  );

  const t0 = performance.now();
  const rawJson = wasm_analyze_multipv_json(
    String(sfen || 'startpos'),
    JSON.stringify(Array.isArray(movesUsi) ? movesUsi : []),
    targetDepth,
    maxNodes,
    safeMultiPv,
  );
  const elapsedMs = Math.max(1, performance.now() - t0);
  const parsed = JSON.parse(rawJson);
  const nps = Math.round(((parsed.nodes || 1) / elapsedMs) * 1000);

  return {
    engineName: ENGINE_NAME,
    evalName: EVAL_NAME,
    depth: parsed.depth,
    seldepth: parsed.seldepth,
    nodes: parsed.nodes,
    nps,
    scoreCpFromTurn: parsed.scoreCpFromTurn,
    mateInFromTurn: parsed.mateInFromTurn,
    bestMoveUsi: parsed.bestMoveUsi,
    pv: parsed.pv,
    multiPvLines: parsed.multiPvLines,
  };
}

export function reviewWithWasm({
  initialSfen = 'startpos',
  movesUsi = [],
} = {}) {
  ensureWasmEngine();
  const safeMoves = Array.isArray(movesUsi) ? movesUsi : [];
  const plyCount = safeMoves.length + 1;
  const maxDepth = plyCount > 80 ? 2 : 3;
  const maxNodesPerPly = Math.max(
    6_000,
    Math.min(40_000, Math.floor(750_000 / Math.max(1, plyCount))),
  );

  const rawJson = wasm_review_game_json(
    String(initialSfen || 'startpos'),
    JSON.stringify(safeMoves),
    maxDepth,
    maxNodesPerPly,
  );
  const parsed = JSON.parse(rawJson);

  return {
    engineName: ENGINE_NAME,
    evalName: EVAL_NAME,
    plies: parsed.plies,
  };
}
