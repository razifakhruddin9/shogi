import { parseVercelBody, WDOOR_TODAY_URL } from '../_wdoor.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseVercelBody(req);
    const safeLimit = Math.max(1, Math.min(35, Number(body.limit) || 25));
    const idxRes = await fetch(WDOOR_TODAY_URL, { redirect: 'follow' });
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
    const games = [];
    const batchSize = 8;

    for (let i = 0; i < chosen.length; i += batchSize) {
      const slice = chosen.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        slice.map(async (href) => {
          try {
            const fullUrl = new URL(href, baseUrl).toString();
            const gRes = await fetch(fullUrl);
            if (!gRes.ok) return null;
            const csaText = await gRes.text();
            const fname = href.split('/').pop() || 'floodgate.csa';
            return { filename: fname, csaText };
          } catch {
            return null;
          }
        }),
      );
      for (const item of batchResults) {
        if (item) games.push(item);
      }
    }

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
