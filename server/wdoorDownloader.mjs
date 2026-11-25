import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const WDOOR_INDEX_URL = 'https://wdoor.c.u-tokyo.ac.jp/shogi/';
const WDOOR_TODAY_URL = 'https://wdoor.c.u-tokyo.ac.jp/shogi/x/today';

const DEFAULT_CATALOG = [
  { year: '2026', file: 'wdoor2026.7z', sizeLabel: '93 MB' },
  { year: '2025', file: 'wdoor2025.7z', sizeLabel: '335 MB' },
  { year: '2024', file: 'wdoor2024.7z', sizeLabel: '338 MB' },
  { year: '2023', file: 'wdoor2023.7z', sizeLabel: '339 MB' },
  { year: '2022', file: 'wdoor2022.7z', sizeLabel: '290 MB' },
  { year: '2021', file: 'wdoor2021.7z', sizeLabel: '352 MB' },
  { year: '2020', file: 'wdoor2020.7z', sizeLabel: '337 MB' },
  { year: '2019', file: 'wdoor2019.7z', sizeLabel: '217 MB' },
  { year: '2018', file: 'wdoor2018.7z', sizeLabel: '107 MB' },
  { year: '2017', file: 'wdoor2017.7z', sizeLabel: '184 MB' },
  { year: '2016', file: 'wdoor2016.7z', sizeLabel: '217 MB' },
  { year: '2015', file: 'wdoor2015.7z', sizeLabel: '182 MB' },
  { year: '2014', file: 'wdoor2014.7z', sizeLabel: '159 MB' },
  { year: '2013', file: 'wdoor2013.7z', sizeLabel: '222 MB' },
  { year: '2012', file: 'wdoor2012.7z', sizeLabel: '167 MB' },
  { year: '2011', file: 'wdoor2011.7z', sizeLabel: '105 MB' },
  { year: '2010', file: 'wdoor2010.7z', sizeLabel: '132 MB' },
  { year: '2009', file: 'wdoor2009.7z', sizeLabel: '85 MB' },
  { year: '2008', file: 'wdoor2008.7z', sizeLabel: '59 MB' },
];

export const wdoorProgress = {
  active: false,
  stage: 'idle',
  year: '',
  percent: 0,
  downloadedMb: 0,
  totalMb: 0,
  message: '',
  error: null,
};

export function getDeviceDatabaseDir() {
  const dir = path.join(os.homedir(), 'Downloads', 'ShogiStudio');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ensureCacheDir() {
  return getDeviceDatabaseDir();
}

export async function fetchWdoorCatalog() {
  const cacheDir = ensureCacheDir();
  let items = DEFAULT_CATALOG;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(WDOOR_INDEX_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      const parsed = [];
      const re = /href="archive\/(wdoor(\d{4})\.7z)"[^>]*>[^<]+<\/a>\s*([\d.]+\s*[MG]B)/gi;
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
    // Use fallback catalog if offline or slow
  }

  return items.map((item) => {
    const archivePath = path.join(cacheDir, item.file);
    const cached = fs.existsSync(archivePath) && fs.statSync(archivePath).size > 1024;
    return {
      ...item,
      url: `${WDOOR_INDEX_URL}archive/${item.file}`,
      cached,
      savedPath: cached ? archivePath : undefined,
    };
  });
}

export async function fetchWdoorTodayGames(limit = 25) {
  const safeLimit = Math.max(1, Math.min(80, Number(limit) || 25));
  const res = await fetch(WDOOR_TODAY_URL, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to fetch Floodgate today index (HTTP ${res.status})`);
  }
  const baseUrl = res.url.endsWith('/') ? res.url : `${res.url}/`;
  const html = await res.text();

  // Prefer finished games (blackwin / whitewin / draw), fallback to all .csa links
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
  const batchSize = 6;

  const todayFolder = path.join(
    ensureCacheDir(),
    `today-${new Date().toISOString().slice(0, 10)}`,
  );
  fs.mkdirSync(todayFolder, { recursive: true });

  for (let i = 0; i < chosen.length; i += batchSize) {
    const slice = chosen.slice(i, i + batchSize);
    const results = await Promise.all(
      slice.map(async (href) => {
        try {
          const fullUrl = new URL(href, baseUrl).toString();
          const gRes = await fetch(fullUrl);
          if (!gRes.ok) return null;
          const csaText = await gRes.text();
          const fname = path.basename(href);
          fs.writeFileSync(path.join(todayFolder, fname), csaText, 'utf8');
          return {
            filename: fname,
            csaText,
          };
        } catch {
          return null;
        }
      }),
    );
    for (const item of results) {
      if (item) games.push(item);
    }
  }

  return {
    sourceUrl: res.url,
    savedDir: todayFolder,
    count: games.length,
    games,
  };
}

export async function downloadAndExtractWdoorYear(year, limit = 150) {
  if (!/^\d{4}$/.test(String(year))) {
    throw new Error('Invalid Floodgate year (expected YYYY)');
  }
  if (wdoorProgress.active) {
    throw new Error('Another Floodgate archive download is already in progress.');
  }

  const safeLimit = Math.max(10, Math.min(500, Number(limit) || 150));
  const cacheDir = ensureCacheDir();
  const filename = `wdoor${year}.7z`;
  const archivePath = path.join(cacheDir, filename);
  const tmpPath = `${archivePath}.part`;
  const extractDir = path.join(cacheDir, `wdoor${year}`);
  const archiveUrl = `${WDOOR_INDEX_URL}archive/${filename}`;

  wdoorProgress.active = true;
  wdoorProgress.stage = 'downloading';
  wdoorProgress.year = year;
  wdoorProgress.percent = 0;
  wdoorProgress.downloadedMb = 0;
  wdoorProgress.totalMb = 0;
  wdoorProgress.error = null;
  wdoorProgress.message = `Connecting to ${archiveUrl}...`;

  try {
    // 1. Download .7z archive if not already cached
    if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size < 1024 * 50) {
      const res = await fetch(archiveUrl);
      if (!res.ok || !res.body) {
        throw new Error(`Failed to download ${filename} (HTTP ${res.status})`);
      }
      const totalBytes = Number(res.headers.get('content-length') || 0);
      wdoorProgress.totalMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

      const fileStream = fs.createWriteStream(tmpPath);
      const reader = res.body.getReader();
      let downloaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(Buffer.from(value));
        downloaded += value.byteLength;
        wdoorProgress.downloadedMb = Math.round((downloaded / (1024 * 1024)) * 10) / 10;
        wdoorProgress.percent = totalBytes
          ? Math.min(99, Math.round((downloaded / totalBytes) * 100))
          : 0;
        wdoorProgress.message = `Downloading ${filename}: ${wdoorProgress.downloadedMb} MB${
          wdoorProgress.totalMb ? ` / ${wdoorProgress.totalMb} MB` : ''
        }`;
      }

      await new Promise((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      fs.renameSync(tmpPath, archivePath);
    }

    // 2. List .csa entries in archive (Windows bsdtar supports .7z natively; Linux uses 7z)
    wdoorProgress.stage = 'listing';
    wdoorProgress.percent = 100;
    wdoorProgress.message = `Inspecting ${filename} contents...`;

    let useSevenZip = false;
    let allCsaEntries = [];
    try {
      const { stdout: listOut } = await execFileAsync('tar', ['-tf', archivePath], {
        maxBuffer: 64 * 1024 * 1024,
      });
      allCsaEntries = listOut
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.toLowerCase().endsWith('.csa'));
    } catch {
      useSevenZip = true;
      const { stdout: listOut } = await execFileAsync('7z', ['l', '-ba', archivePath], {
        maxBuffer: 64 * 1024 * 1024,
      });
      allCsaEntries = listOut
        .split(/\r?\n/)
        .map((l) => l.trim().split(/\s+/).pop() || '')
        .filter((l) => l.toLowerCase().endsWith('.csa'));
    }

    // Take newest games from the end of the yearly archive
    const selectedEntries = allCsaEntries.slice(-safeLimit).reverse();

    // 3. Extract selected .csa entries in batches
    wdoorProgress.stage = 'extracting';
    wdoorProgress.message = `Extracting ${selectedEntries.length} CSA games from ${filename}...`;
    fs.mkdirSync(extractDir, { recursive: true });

    const chunkSize = 30;
    for (let i = 0; i < selectedEntries.length; i += chunkSize) {
      const chunk = selectedEntries.slice(i, i + chunkSize);
      if (useSevenZip) {
        await execFileAsync('7z', ['x', '-y', `-o${extractDir}`, archivePath, ...chunk], {
          maxBuffer: 16 * 1024 * 1024,
        });
      } else {
        await execFileAsync('tar', ['-xf', archivePath, '-C', extractDir, ...chunk], {
          maxBuffer: 16 * 1024 * 1024,
        });
      }
    }

    // 4. Read extracted .csa files
    wdoorProgress.stage = 'parsing';
    wdoorProgress.message = `Loading ${selectedEntries.length} games into database...`;
    const games = [];
    for (const entry of selectedEntries) {
      const fullFile = path.join(extractDir, entry);
      if (!fs.existsSync(fullFile)) continue;
      const csaText = fs.readFileSync(fullFile, 'utf8');
      games.push({
        filename: path.basename(entry),
        csaText,
      });
    }

    wdoorProgress.stage = 'done';
    wdoorProgress.message = `Imported ${games.length} games from ${filename}.`;
    return {
      year,
      totalInArchive: allCsaEntries.length,
      savedArchivePath: archivePath,
      savedExtractDir: extractDir,
      games,
    };
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup error
      }
    }
    wdoorProgress.stage = 'error';
    wdoorProgress.error = err.message;
    throw err;
  } finally {
    wdoorProgress.active = false;
  }
}
