import { parseVercelBody, WDOOR_TODAY_URL } from '../_wdoor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.method === 'POST' ? await parseVercelBody(req) : {};
    const safeLimit = Math.max(1, Math.min(20, Number(body.limit) || 18));
    const idxRes = await fetch(WDOOR_TODAY_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': 'ShogiStudio/1.0' },
      signal: AbortSignal.timeout(4500),
    });
    if (!idxRes.ok) {
      res.status(502).json({
        error: `Gagal mengambil indeks Floodgate hari ini (HTTP ${idxRes.status}).`,
      });
      return;
    }

    const baseUrl = idxRes.url.endsWith('/') ? idxRes.url : `${idxRes.url}/`;
    const html = await idxRes.text();

    const finishedLinks = [];
    const otherLinks = [];
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
      const row = m[1];
      const csaMatch = row.match(/href="([^"]+\.csa)"/i);
      if (!csaMatch) continue;
      const href = csaMatch[1];
      if (/blackwin|whitewin|draw|sennichite/i.test(row)) {
        finishedLinks.push(href);
      } else {
        otherLinks.push(href);
      }
    }

    const chosen = [...finishedLinks, ...otherLinks].slice(0, safeLimit);
    const batchResults = await Promise.all(
      chosen.map(async (href) => {
        try {
          const fullUrl = new URL(href, baseUrl).toString();
          const gRes = await fetch(fullUrl, {
            headers: { 'User-Agent': 'ShogiStudio/1.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (!gRes.ok) return null;
          const csaText = await gRes.text();
          const fname = href.split('/').pop() || 'floodgate.csa';
          return { filename: fname, csaText };
        } catch {
          return null;
        }
      }),
    );

    const games = batchResults.filter(Boolean);
    res.status(200).json({
      sourceUrl: idxRes.url,
      count: games.length,
      games,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Gagal mengunduh partai hari ini.',
    });
  }
}
