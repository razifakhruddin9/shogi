import { ENGINE_NAME, EVAL_NAME, ensureWasmEngine } from './_wasmEngine.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    ensureWasmEngine();
    res.status(200).json({
      ready: true,
      cloudServerless: true,
      engineName: ENGINE_NAME,
      evalName: EVAL_NAME,
      evalFilePresent: true,
      exePresent: true,
    });
  } catch (err) {
    res.status(200).json({
      ready: false,
      cloudServerless: true,
      engineName: 'Web Worker Engine (Browser)',
      evalName: err instanceof Error ? err.message : 'WASM init fallback',
      evalFilePresent: false,
      exePresent: false,
    });
  }
}
