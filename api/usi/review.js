import { parseVercelBody } from '../_wdoor.js';
import { reviewWithWasm } from './_wasmEngine.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = await parseVercelBody(req);
    const result = reviewWithWasm({
      initialSfen: body.initialSfen || 'startpos',
      movesUsi: Array.isArray(body.movesUsi) ? body.movesUsi : [],
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Rust/WASM game review failed',
    });
  }
}
