import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  downloadAndExtractWdoorYear,
  fetchWdoorCatalog,
  fetchWdoorTodayGames,
  getDeviceDatabaseDir,
  wdoorProgress,
} from './wdoorDownloader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ENGINE_DIR = path.join(ROOT_DIR, 'engine-bin');
const ENGINE_EXE =
  process.env.USI_ENGINE_BIN ||
  path.join(
    ENGINE_DIR,
    'YaneuraOu_NNUE_halfkp_256x2_32_32-V900Git_AVX2.exe',
  );
const EVAL_FILE = path.join(ENGINE_DIR, 'eval', 'nn.bin');
const PORT = Number(process.env.PORT || process.env.USI_PORT || 3891);
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

class YaneuraOuBridge {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.engineName = 'YaneuraOu NNUE V9.00Git 64AVX2';
    this.evalName = 'Suisho5 (nn.bin)';
    this.buffer = '';
    this.queue = Promise.resolve();
    this.activeSearch = null;
  }

  start() {
    if (process.platform !== 'win32' && ENGINE_EXE.endsWith('.exe')) {
      console.log(
        '[YaneuraOuBridge] Non-Windows host without Linux USI_ENGINE_BIN; clients will use built-in Web Worker AI.',
      );
      return;
    }
    if (!fs.existsSync(ENGINE_EXE)) {
      throw new Error(`YaneuraOu executable not found at ${ENGINE_EXE}`);
    }
    if (!fs.existsSync(EVAL_FILE)) {
      throw new Error(`Suisho5 nn.bin not found at ${EVAL_FILE}`);
    }

    this.proc = spawn(ENGINE_EXE, [], {
      cwd: ENGINE_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) this.handleLine(line.trim());
      }
    });

    this.proc.stderr.on('data', (chunk) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.error('[YaneuraOu stderr]', msg);
    });

    this.proc.on('exit', (code) => {
      console.warn(`[YaneuraOu] exited with code ${code}`);
      this.ready = false;
      this.proc = null;
      if (this.activeSearch) {
        this.activeSearch.reject(new Error('Engine exited unexpectedly'));
        this.activeSearch = null;
      }
    });

    this.send('usi');
    this.send('setoption name Threads value 4');
    this.send('setoption name USI_Hash value 256');
    this.send('setoption name USI_OwnBook value false');
    this.send('setoption name ConsiderationMode value true');
    this.send('setoption name PvInterval value 0');
    this.send('isready');
  }

  send(cmd) {
    if (this.proc && this.proc.stdin.writable) {
      this.proc.stdin.write(`${cmd}\n`);
    }
  }

  handleLine(line) {
    if (line.startsWith('id name ')) {
      this.engineName = line.slice(8).trim();
      return;
    }
    if (line === 'readyok') {
      this.ready = true;
      console.log(`[YaneuraOuBridge] Ready: ${this.engineName} + ${this.evalName}`);
      return;
    }

    const active = this.activeSearch;
    if (!active) return;

    if (line.startsWith('info ')) {
      const parsed = parseUsiInfoLine(line);
      if (parsed) {
        active.latestByPv.set(parsed.multipv, parsed);
        if (parsed.depth >= active.maxDepth) {
          active.maxDepth = parsed.depth;
        }
        if (parsed.seldepth > active.maxSeldepth) {
          active.maxSeldepth = parsed.seldepth;
        }
        if (parsed.nodes > 0) active.nodes = parsed.nodes;
        if (parsed.nps > 0) active.nps = parsed.nps;
      }
      return;
    }

    if (line.startsWith('bestmove ')) {
      clearTimeout(active.timer);
      const parts = line.split(/\s+/);
      const bestMoveUsi = parts[1] && parts[1] !== 'resign' ? parts[1] : undefined;
      const ponderIdx = parts.indexOf('ponder');
      const ponderUsi = ponderIdx !== -1 ? parts[ponderIdx + 1] : undefined;

      const pvLines = Array.from(active.latestByPv.values()).sort(
        (a, b) => a.multipv - b.multipv,
      );
      const primary = pvLines[0];

      const result = {
        engineName: this.engineName,
        evalName: this.evalName,
        depth: primary?.depth ?? active.maxDepth,
        seldepth: primary?.seldepth ?? active.maxSeldepth,
        nodes: primary?.nodes ?? active.nodes,
        nps: primary?.nps ?? active.nps,
        scoreCpFromTurn: primary?.scoreCp ?? 0,
        mateInFromTurn: primary?.mateIn,
        bestMoveUsi: bestMoveUsi ?? primary?.pv[0],
        ponderUsi,
        pv: primary?.pv ?? (bestMoveUsi ? [bestMoveUsi] : []),
        multiPvLines: pvLines,
        resign: parts[1] === 'resign',
      };

      this.activeSearch = null;
      active.resolve(result);
    }
  }

  analyze({ sfen, movesUsi, movetimeMs = 450, multiPv = 3, depth }) {
    // Stop any currently running search promptly so latest user click wins
    if (this.activeSearch) {
      this.send('stop');
    }

    const runTask = () =>
      new Promise((resolve, reject) => {
        if (!this.proc || !this.ready) {
          reject(new Error('YaneuraOu + Suisho5 engine is initializing or offline.'));
          return;
        }

        const safeMultiPv = Math.max(1, Math.min(5, Number(multiPv) || 1));
        const safeTime = Math.max(80, Math.min(8000, Number(movetimeMs) || 450));

        const timer = setTimeout(() => {
          this.send('stop');
        }, safeTime + 1500);

        this.activeSearch = {
          latestByPv: new Map(),
          maxDepth: 0,
          maxSeldepth: 0,
          nodes: 0,
          nps: 0,
          timer,
          resolve,
          reject,
        };

        this.send(`setoption name MultiPV value ${safeMultiPv}`);
        if (movesUsi && movesUsi.length > 0) {
          const base =
            sfen && sfen !== 'startpos' ? `sfen ${sfen}` : 'startpos';
          this.send(`position ${base} moves ${movesUsi.join(' ')}`);
        } else {
          const base =
            sfen && sfen !== 'startpos' ? `sfen ${sfen}` : 'startpos';
          this.send(`position ${base}`);
        }

        if (depth && depth > 0) {
          this.send(`go depth ${Math.min(24, Number(depth))}`);
        } else {
          this.send(`go movetime ${safeTime}`);
        }
      });

    this.queue = this.queue.then(runTask, runTask);
    return this.queue;
  }
}

function parseUsiInfoLine(line) {
  const tokens = line.split(/\s+/);
  let depth = 0;
  let seldepth = 0;
  let multipv = 1;
  let nodes = 0;
  let nps = 0;
  let scoreCp = 0;
  let mateIn;
  let pv = [];
  let hasScore = false;

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === 'depth' && tokens[i + 1]) {
      depth = Number(tokens[++i]) || 0;
    } else if (t === 'seldepth' && tokens[i + 1]) {
      seldepth = Number(tokens[++i]) || 0;
    } else if (t === 'multipv' && tokens[i + 1]) {
      multipv = Number(tokens[++i]) || 1;
    } else if (t === 'nodes' && tokens[i + 1]) {
      nodes = Number(tokens[++i]) || 0;
    } else if (t === 'nps' && tokens[i + 1]) {
      nps = Number(tokens[++i]) || 0;
    } else if (t === 'score' && tokens[i + 1]) {
      const kind = tokens[++i];
      const val = tokens[++i];
      hasScore = true;
      if (kind === 'cp') {
        scoreCp = Number(val) || 0;
      } else if (kind === 'mate') {
        if (val === '+') mateIn = 1;
        else if (val === '-') mateIn = -1;
        else mateIn = Number(val) || 1;
        scoreCp = mateIn > 0 ? 18000 : -18000;
      }
    } else if (t === 'pv') {
      pv = tokens.slice(i + 1);
      break;
    }
  }

  if (!hasScore || pv.length === 0) return null;
  return { depth, seldepth, multipv, nodes, nps, scoreCp, mateIn, pv };
}

const bridge = new YaneuraOuBridge();
try {
  bridge.start();
} catch (err) {
  console.error('[YaneuraOuBridge] Startup failed:', err.message);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/usi/status') {
    sendJson(res, 200, {
      ready: bridge.ready,
      engineName: bridge.engineName,
      evalName: bridge.evalName,
      evalFilePresent: fs.existsSync(EVAL_FILE),
      exePresent: fs.existsSync(ENGINE_EXE),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/usi/analyze') {
    try {
      const body = await readJsonBody(req);
      const result = await bridge.analyze({
        sfen: body.sfen || 'startpos',
        movesUsi: Array.isArray(body.movesUsi) ? body.movesUsi : undefined,
        movetimeMs: body.movetimeMs ?? 450,
        multiPv: body.multiPv ?? 3,
        depth: body.depth,
      });
      sendJson(res, 200, result);
    } catch (err) {
      sendJson(res, 503, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/usi/review') {
    try {
      const body = await readJsonBody(req);
      const initialSfen = body.initialSfen || 'startpos';
      const movesUsi = Array.isArray(body.movesUsi) ? body.movesUsi : [];
      const perPlyMs = Math.max(80, Math.min(500, Number(body.movetimeMs) || 140));
      const initialTurn = initialSfen.includes(' w ') ? 'w' : 'b';

      const plies = [];
      // Evaluate starting position (ply 0) + each subsequent ply
      for (let ply = 0; ply <= movesUsi.length; ply++) {
        const prefixMoves = movesUsi.slice(0, ply);
        const turnAtPly =
          ply % 2 === 0
            ? initialTurn
            : initialTurn === 'b'
              ? 'w'
              : 'b';
        const resEval = await bridge.analyze({
          sfen: initialSfen,
          movesUsi: prefixMoves,
          movetimeMs: perPlyMs,
          multiPv: 1,
        });
        const sign = turnAtPly === 'b' ? 1 : -1;
        plies.push({
          ply,
          turn: turnAtPly,
          scoreCp: resEval.scoreCpFromTurn * sign,
          mateIn:
            resEval.mateInFromTurn !== undefined
              ? resEval.mateInFromTurn * sign
              : undefined,
          bestMoveUsi: resEval.bestMoveUsi,
          depth: resEval.depth,
          nodes: resEval.nodes,
        });
      }

      sendJson(res, 200, {
        engineName: bridge.engineName,
        evalName: bridge.evalName,
        plies,
      });
    } catch (err) {
      sendJson(res, 503, { error: err.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/wdoor/catalog') {
    try {
      const items = await fetchWdoorCatalog();
      sendJson(res, 200, {
        sourceUrl: 'https://wdoor.c.u-tokyo.ac.jp/shogi/',
        deviceDir: getDeviceDatabaseDir(),
        items,
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/wdoor/progress') {
    sendJson(res, 200, wdoorProgress);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/wdoor/today') {
    try {
      const body = await readJsonBody(req);
      const data = await fetchWdoorTodayGames(body.limit ?? 25);
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/wdoor/download') {
    try {
      const body = await readJsonBody(req);
      const data = await downloadAndExtractWdoorYear(
        String(body.year || '2026'),
        body.limit ?? 150,
      );
      sendJson(res, 200, data);
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }
    return;
  }

  if (!url.pathname.startsWith('/api/') && (req.method === 'GET' || req.method === 'HEAD')) {
    if (fs.existsSync(DIST_DIR)) {
      const reqRel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      const candidate = path.resolve(DIST_DIR, reqRel);
      const isInsideDist =
        candidate === DIST_DIR || candidate.startsWith(DIST_DIR + path.sep);
      const filePath =
        isInsideDist && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
          ? candidate
          : path.join(DIST_DIR, 'index.html');

      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          fs.createReadStream(filePath).pipe(res);
        }
        return;
      }
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[ShogiStudio] Listening on http://${HOST}:${PORT}`);
});
