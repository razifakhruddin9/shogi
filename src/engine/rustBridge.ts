import { toSfen } from './sfen';
import { EngineEvaluation, ShogiMove, ShogiPosition } from './types';
import initWasm, {
  wasm_evaluate_sfen,
  wasm_generate_legal_moves_json,
  wasm_material_balance_json,
  wasm_parse_sfen_json,
  wasm_search_best_move_json,
  wasm_to_sfen,
} from './wasm/shogi_core';
import wasmAssetUrl from './wasm/shogi_core_bg.wasm?url';

let initPromise: Promise<boolean> | null = null;
let ready = false;

export function isRustCoreReady(): boolean {
  return ready;
}

export function initRustCore(wasmBytes?: BufferSource): Promise<boolean> {
  if (ready) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = (async () => {
      try {
        if (wasmBytes) {
          await initWasm({ module_or_path: wasmBytes });
        } else {
          await initWasm({ module_or_path: wasmAssetUrl });
        }
        ready = true;
        return true;
      } catch {
        ready = false;
        return false;
      }
    })();
  }
  return initPromise;
}

export function rustParseSfen(sfen: string): ShogiPosition {
  return JSON.parse(wasm_parse_sfen_json(sfen)) as ShogiPosition;
}

export function rustToSfen(pos: ShogiPosition, includeMoveNumber = true): string {
  return wasm_to_sfen(JSON.stringify(pos), includeMoveNumber);
}

export function rustGenerateLegalMoves(pos: ShogiPosition): ShogiMove[] {
  const sfen = toSfen(pos, true);
  return JSON.parse(wasm_generate_legal_moves_json(sfen)) as ShogiMove[];
}

export function rustEvaluatePosition(pos: ShogiPosition): number {
  return wasm_evaluate_sfen(toSfen(pos, true));
}

export function rustGetMaterialBalance(
  pos: ShogiPosition,
): { b: number; w: number; diff: number } {
  return JSON.parse(wasm_material_balance_json(toSfen(pos, true))) as {
    b: number;
    w: number;
    diff: number;
  };
}

export function rustSearchBestMove(
  pos: ShogiPosition,
  options: { maxDepth?: number; timeLimitMs?: number; elo?: number } = {},
): EngineEvaluation {
  const maxDepth = options.maxDepth ?? 3;
  const timeLimitMs = options.timeLimitMs ?? 600;
  const elo = options.elo ?? 1600;

  // Preserve low-Elo randomized beginner personality from original TS engine
  if (elo <= 750 && Math.random() < 0.35) {
    const legal = rustGenerateLegalMoves(pos);
    if (legal.length > 0) {
      const pool = legal.slice(0, Math.min(8, legal.length));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      return {
        scoreCp: rustEvaluatePosition(pos),
        bestMove: pick,
        pv: [pick.usi],
        depth: 1,
        nodes: legal.length,
      };
    }
  }

  // Scale node budget proportionally to timeLimitMs (Rust/WASM explores far faster than JS)
  const maxNodes = Math.max(20_000, Math.min(2_500_000, Math.round(timeLimitMs * 1800)));
  const json = wasm_search_best_move_json(toSfen(pos, true), maxDepth, maxNodes);
  return JSON.parse(json) as EngineEvaluation;
}
