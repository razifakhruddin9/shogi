import { searchBestMove } from './ai';
import { ShogiPosition } from './types';

export interface WorkerRequest {
  id: number;
  pos: ShogiPosition;
  maxDepth?: number;
  timeLimitMs?: number;
  elo?: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, pos, maxDepth, timeLimitMs, elo } = e.data;
  const result = searchBestMove(pos, { maxDepth, timeLimitMs, elo });
  self.postMessage({ id, result });
};
