import { parseVercelBody, WDOOR_INDEX_URL } from '../_wdoor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const body = await parseVercelBody(req);
  const year = String(body.year || '2026');
  if (!/^\d{4}$/.test(year)) {
    res.status(400).json({ error: 'Invalid Floodgate year (expected YYYY).' });
    return;
  }

  const filename = `wdoor${year}.7z`;
  const archiveUrl = `${WDOOR_INDEX_URL}archive/${filename}`;
  res.status(200).json({
    fallbackDirectDownload: true,
    archiveUrl,
    filename,
    message:
      'Di hosting Vercel, arsip tahunan .7z (60–350 MB) diunduh langsung ke perangkat Anda. Ekstrak file .csa lalu masukkan lewat tab Import Local.',
  });
}
