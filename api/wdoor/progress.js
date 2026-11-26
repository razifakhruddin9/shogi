export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.status(200).json({
    active: false,
    stage: 'idle',
    year: '',
    percent: 0,
    downloadedMb: 0,
    totalMb: 0,
    message: '',
    error: null,
  });
}
