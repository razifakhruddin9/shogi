import { DEFAULT_CATALOG, WDOOR_INDEX_URL } from '../_wdoor.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let items = DEFAULT_CATALOG;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const r = await fetch(WDOOR_INDEX_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (r.ok) {
      const html = await r.text();
      const parsed = [];
      const re =
        /href="archive\/(wdoor(\d{4})\.7z)"[^>]*>[^<]+<\/a>\s*([\d.]+\s*[MG]B)/gi;
      let match;
      while ((match = re.exec(html)) !== null) {
        parsed.push({
          file: match[1],
          year: match[2],
          sizeLabel: match[3].trim(),
        });
      }
      if (parsed.length > 0) items = parsed;
    }
  } catch {
    // fallback catalog
  }

  res.status(200).json({
    sourceUrl: WDOOR_INDEX_URL,
    serverless: true,
    deviceDir: 'Browser Downloads & IndexedDB',
    items: items.map((item) => ({
      ...item,
      url: `${WDOOR_INDEX_URL}archive/${item.file}`,
      cached: false,
    })),
  });
}
