import { searchBestMove } from './ai';
import { initRustCore, isRustCoreReady, rustSearchBestMove } from './rustBridge';
import { ShogiPosition } from './types';

export interface WorkerRequest {
  id: number;
  pos: ShogiPosition;
  maxDepth?: number;
  timeLimitMs?: number;
  elo?: number;
}

// Pre-warm compiled Rust/WASM Shogi core engine inside the worker
void initRustCore();

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, pos, maxDepth, timeLimitMs, elo } = e.data;
  const wasmOk = isRustCoreReady() || (await initRustCore());
  const result = wasmOk
    ? rustSearchBestMove(pos, { maxDepth, timeLimitMs, elo })
    : searchBestMove(pos, { maxDepth, timeLimitMs, elo });
  self.postMessage({ id, result });
};
