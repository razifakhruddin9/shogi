export default function handler(req, res) {
  res.status(503).json({
    error: 'Native YaneuraOu USI binary is only available locally; browser Web Worker engine is active.',
  });
}
