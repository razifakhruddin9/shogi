import { basePieceType, parseSfen, toSfen } from './sfen';
import { applyMove, findLegalMoveByUsi, generateLegalMoves } from './shogi';
import {
  INITIAL_SFEN,
  Piece,
  PieceType,
  ShogiMove,
  ShogiPosition,
  Side,
  Square,
} from './types';

export type DatabaseFormat = 'kif' | 'ki2' | 'csa' | 'sfen';

export interface ParsedDatabaseGame {
  id: string;
  format: DatabaseFormat;
  title: string;
  event?: string;
  senteName: string;
  goteName: string;
  senteElo?: number;
  goteElo?: number;
  result: '1-0' | '0-1' | '½-½' | '*';
  dateLabel: string;
  initialSfen: string;
  movesUsi: string[];
  rawSource?: string;
  parseWarnings?: string[];
}

const ZENKAKU_DIGITS: Record<string, string> = {
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
};

const KANJI_NUMS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const KIF_PIECE_MAP: Record<string, PieceType> = {
  王: 'K',
  玉: 'K',
  飛: 'R',
  龍: '+R',
  竜: '+R',
  角: 'B',
  馬: '+B',
  金: 'G',
  銀: 'S',
  成銀: '+S',
  全: '+S',
  桂: 'N',
  成桂: '+N',
  圭: '+N',
  香: 'L',
  成香: '+L',
  杏: '+L',
  歩: 'P',
  と: '+P',
  と金: '+P',
};

const CSA_PIECE_MAP: Record<string, PieceType> = {
  OU: 'K',
  HI: 'R',
  RY: '+R',
  KA: 'B',
  UM: '+B',
  KI: 'G',
  GI: 'S',
  NG: '+S',
  KE: 'N',
  NK: '+N',
  KY: 'L',
  NY: '+L',
  FU: 'P',
  TO: '+P',
};

function toHalfWidthDigits(str: string): string {
  return str.replace(/[１-９]/g, (ch) => ZENKAKU_DIGITS[ch] ?? ch);
}

function parseKifSquare(fileCh: string, rankCh: string): Square | null {
  const f = Number(toHalfWidthDigits(fileCh));
  const r = KANJI_NUMS[rankCh] ?? Number(toHalfWidthDigits(rankCh));
  if (!f || f < 1 || f > 9 || !r || r < 1 || r > 9) return null;
  return { row: r - 1, col: 9 - f };
}

function parseOriginDigits(pair: string): Square | null {
  if (!/^[1-9]{2}$/.test(pair)) return null;
  const f = Number(pair[0]);
  const r = Number(pair[1]);
  return { row: r - 1, col: 9 - f };
}

function sameSquare(a: Square | undefined, b: Square | undefined): boolean {
  if (!a || !b) return false;
  return a.row === b.row && a.col === b.col;
}

/**
 * Parses BOD (KIF board diagram) if present in a KIF/KI2 file, else returns standard initial position.
 */
function parseBodOrDefault(lines: string[]): ShogiPosition {
  const boardRows = lines.filter((l) => /^\|.*\|[一二三四五六七八九]/.test(l.trim()));
  if (boardRows.length !== 9) {
    return parseSfen(INITIAL_SFEN);
  }

  const pos = parseSfen('9/9/9/9/9/9/9/9/9 b - 1');
  for (let r = 0; r < 9; r++) {
    const line = boardRows[r].trim();
    const inner = line.slice(1, line.lastIndexOf('|'));
    // Each cell in BOD is 2 chars: (' ' or 'v') + kanji (or ' ・')
    let idx = 0;
    for (let c = 0; c < 9 && idx + 1 < inner.length; c++) {
      const marker = inner[idx];
      const glyph = inner[idx + 1];
      idx += 2;
      if (glyph === '・' || glyph === ' ') continue;
      const side: Side = marker === 'v' || marker === 'V' || marker === '△' ? 'w' : 'b';
      const pType = KIF_PIECE_MAP[glyph];
      if (pType) {
        pos.board[r][c] = { type: pType, side };
      }
    }
  }

  const parseBodHand = (linePrefix: string, side: Side) => {
    const line = lines.find((l) => l.trim().startsWith(linePrefix));
    if (!line) return;
    const raw = line.split('：')[1]?.trim() ?? '';
    if (!raw || raw === 'なし') return;
    const tokens = raw.split(/[\s　]+/).filter(Boolean);
    for (const tok of tokens) {
      const ch = tok[0];
      const pType = KIF_PIECE_MAP[ch];
      if (!pType) continue;
      const base = basePieceType(pType);
      if (base === 'K') continue;
      const countStr = tok.slice(1).replace(/[一二三四五六七八九十]/g, (k) => {
        if (k === '十') return '10';
        return String(KANJI_NUMS[k] ?? '');
      });
      const count = Number(toHalfWidthDigits(countStr)) || 1;
      pos.hands[side][base] += count;
    }
  };

  parseBodHand('先手の持駒：', 'b');
  parseBodHand('後手の持駒：', 'w');
  if (lines.some((l) => l.trim().startsWith('後手番'))) {
    pos.turn = 'w';
  }
  return pos;
}

/**
 * Resolves a KIF or KI2 Japanese move string against legal moves in `pos`.
 */
function resolveJapaneseMove(
  pos: ShogiPosition,
  rawMoveText: string,
  prevDest: Square | null,
): ShogiMove | null {
  let text = rawMoveText
    .replace(/^[▲△▽☗☖]/, '')
    .replace(/\(.*?\)/g, '') // strip origin if KI2 style; we handle KIF origin separately too
    .replace(/[\s　]+/g, '')
    .trim();

  // Check if KIF explicit origin "(77)" was provided in rawMoveText
  const originMatch = rawMoveText.match(/\((\d{2})\)/);
  const explicitOrigin = originMatch ? parseOriginDigits(originMatch[1]) : null;

  let toSq: Square | null = null;
  if (text.startsWith('同')) {
    toSq = prevDest;
    text = text.slice(1);
  } else {
    const norm = toHalfWidthDigits(text);
    if (norm.length >= 2) {
      toSq = parseKifSquare(norm[0], norm[1]);
      text = norm.slice(2);
    }
  }
  if (!toSq) return null;

  // Detect promotion / unpromoted / drop flags
  const isDrop = text.includes('打');
  const isPromote = text.endsWith('成') && !text.endsWith('不成');
  const isUnpromote = text.endsWith('不成');
  text = text.replace(/打$/, '').replace(/不成$/, '').replace(/成$/, '');

  // Disambiguation modifiers in KI2: 右, 左, 直, 上, 引, 寄, 行
  const hasRight = text.includes('右');
  const hasLeft = text.includes('左');
  const hasStraight = text.includes('直');
  const hasUp = text.includes('上') || text.includes('行');
  const hasDown = text.includes('引');
  const hasSide = text.includes('寄');
  const pieceText = text.replace(/[右左直上引寄行]/g, '');

  const expectedPiece = KIF_PIECE_MAP[pieceText];
  if (!expectedPiece) return null;

  const legal = generateLegalMoves(pos);
  let candidates = legal.filter((m) => {
    if (!sameSquare(m.to, toSq!)) return false;
    if (m.piece !== expectedPiece) return false;
    if (isDrop && !m.drop) return false;
    if (explicitOrigin && (m.drop || !sameSquare(m.from, explicitOrigin))) return false;
    if (isPromote && !m.promote) return false;
    if (isUnpromote && m.promote) return false;
    return true;
  });

  if (candidates.length === 0 && !isDrop) {
    // Some KIF files write e.g. 歩成 without explicit origin if only one can promote
    candidates = legal.filter(
      (m) => sameSquare(m.to, toSq!) && m.piece === expectedPiece,
    );
  }

  if (candidates.length <= 1) {
    return candidates[0] ?? null;
  }

  // Apply KI2 directional disambiguation relative to moving side
  const side = pos.turn;
  const filtered = candidates.filter((m) => {
    if (m.drop || !m.from) return isDrop;
    const dr = m.to.row - m.from.row; // positive = down screen
    const dc = m.to.col - m.from.col; // positive = right screen
    const forwardDr = side === 'b' ? -dr : dr; // positive = advancing toward opponent
    const rightDc = side === 'b' ? -dc : dc; // from player's perspective: right is lower col for Sente? Wait: Sente faces UP (col 0 = file 9 left, col 8 = file 1 right).
    // Wait: Sente's left is file 9 (col 0), Sente's right is file 1 (col 8)!
    // So if piece is on file 2 (col 7) moving to file 3 (col 6), it came from the RIGHT (from.col > to.col -> dc < 0)!
    const cameFromPlayersRight = side === 'b' ? m.from.col > m.to.col : m.from.col < m.to.col;
    const cameFromPlayersLeft = side === 'b' ? m.from.col < m.to.col : m.from.col > m.to.col;

    if (hasStraight && dc !== 0) return false;
    if (hasUp && forwardDr <= 0) return false;
    if (hasDown && forwardDr >= 0) return false;
    if (hasSide && dr !== 0) return false;
    if (hasRight && !cameFromPlayersRight) {
      // Also check relative to other candidates
      void rightDc;
      return false;
    }
    if (hasLeft && !cameFromPlayersLeft) return false;
    return true;
  });

  if (filtered.length > 0) return filtered[0];
  // Prefer non-drop if ambiguous unless 打 was specified
  const nonDrop = candidates.find((c) => !c.drop);
  return nonDrop ?? candidates[0];
}

function detectResultFromText(text: string, lastMover: Side | null): '1-0' | '0-1' | '½-½' | '*' {
  if (/千日手|%SENNICHITE|持将棋|%JISHOGI/i.test(text)) return '½-½';
  if (/先手.*勝/.test(text)) return '1-0';
  if (/後手.*勝/.test(text)) return '0-1';
  if (/投了|詰み|%TORYO|%TSUMI|%TIME_UP/i.test(text)) {
    if (lastMover === 'b') return '1-0';
    if (lastMover === 'w') return '0-1';
  }
  return '*';
}

export function parseKifText(content: string, fallbackTitle = 'KIF Game'): ParsedDatabaseGame {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  let senteName = 'Sente';
  let goteName = 'Gote';
  let event = '';
  let dateLabel = 'Imported';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('先手：') || trimmed.startsWith('▲')) {
      const val = trimmed.replace(/^先手：/, '').trim();
      if (val && !trimmed.startsWith('▲')) senteName = val;
    } else if (trimmed.startsWith('後手：') || trimmed.startsWith('△')) {
      const val = trimmed.replace(/^後手：/, '').trim();
      if (val && !trimmed.startsWith('△')) goteName = val;
    } else if (trimmed.startsWith('棋戦：')) {
      event = trimmed.replace(/^棋戦：/, '').trim();
    } else if (trimmed.startsWith('開始日時：')) {
      dateLabel = trimmed.replace(/^開始日時：/, '').trim().slice(0, 10) || 'Imported';
    }
  }

  let pos = parseBodOrDefault(lines);
  const initialSfen = toSfen(pos);
  const movesUsi: string[] = [];
  const parseWarnings: string[] = [];
  let prevDest: Square | null = null;
  let lastMover: Side | null = null;
  let terminalText = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    // Match numbered KIF line: e.g. "1 ７六歩(77) ( 0:02/00:00:02)"
    const m = trimmed.match(/^\d+\s+([^\s(]+(?:\(\d{2}\))?)/);
    if (!m) continue;
    const token = m[1];
    if (/^(投了|中断|千日手|持将棋|詰み|切れ負け|反則)/.test(token)) {
      terminalText = token;
      break;
    }
    const resolved = resolveJapaneseMove(pos, token, prevDest);
    if (!resolved) {
      parseWarnings.push(`Skipped unrecognized KIF move: ${token}`);
      break;
    }
    movesUsi.push(resolved.usi);
    prevDest = resolved.to;
    lastMover = pos.turn;
    pos = applyMove(pos, resolved);
  }

  const title = event ? `${event}: ${senteName} vs ${goteName}` : `${senteName} vs ${goteName}`;
  return {
    id: `db-kif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    format: 'kif',
    title: title === 'Sente vs Gote' ? fallbackTitle : title,
    event: event || undefined,
    senteName,
    goteName,
    result: detectResultFromText(terminalText || content, lastMover),
    dateLabel,
    initialSfen,
    movesUsi,
    rawSource: content,
    parseWarnings: parseWarnings.length ? parseWarnings : undefined,
  };
}

export function parseKi2Text(content: string, fallbackTitle = 'KI2 Game'): ParsedDatabaseGame {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  let senteName = 'Sente';
  let goteName = 'Gote';
  let event = '';
  let dateLabel = 'Imported';
  const moveTokens: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('先手：')) {
      senteName = trimmed.replace(/^先手：/, '').trim() || senteName;
      continue;
    }
    if (trimmed.startsWith('後手：')) {
      goteName = trimmed.replace(/^後手：/, '').trim() || goteName;
      continue;
    }
    if (trimmed.startsWith('棋戦：')) {
      event = trimmed.replace(/^棋戦：/, '').trim();
      continue;
    }
    if (trimmed.startsWith('開始日時：')) {
      dateLabel = trimmed.replace(/^開始日時：/, '').trim().slice(0, 10) || 'Imported';
      continue;
    }
    if (trimmed.includes('▲') || trimmed.includes('△') || trimmed.includes('▽')) {
      // Split inline moves like "▲７六歩 △３四歩 ▲２六歩"
      const parts = trimmed.match(/[▲△▽☗☖][^▲△▽☗☖\n]+/g);
      if (parts) {
        for (const p of parts) {
          moveTokens.push(p.trim());
        }
      }
    }
  }

  let pos = parseBodOrDefault(lines);
  const initialSfen = toSfen(pos);
  const movesUsi: string[] = [];
  const parseWarnings: string[] = [];
  let prevDest: Square | null = null;
  let lastMover: Side | null = null;

  for (const tok of moveTokens) {
    if (/まで/.test(tok)) break;
    const resolved = resolveJapaneseMove(pos, tok, prevDest);
    if (!resolved) {
      parseWarnings.push(`Skipped unrecognized KI2 move: ${tok}`);
      break;
    }
    movesUsi.push(resolved.usi);
    prevDest = resolved.to;
    lastMover = pos.turn;
    pos = applyMove(pos, resolved);
  }

  const title = event ? `${event}: ${senteName} vs ${goteName}` : `${senteName} vs ${goteName}`;
  return {
    id: `db-ki2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    format: 'ki2',
    title: title === 'Sente vs Gote' ? fallbackTitle : title,
    event: event || undefined,
    senteName,
    goteName,
    result: detectResultFromText(content, lastMover),
    dateLabel,
    initialSfen,
    movesUsi,
    rawSource: content,
    parseWarnings: parseWarnings.length ? parseWarnings : undefined,
  };
}

function parseSingleCsaGame(chunk: string, fallbackTitle: string): ParsedDatabaseGame {
  const lines = chunk.replace(/\r\n?/g, '\n').split('\n');
  let senteName = 'Sente';
  let goteName = 'Gote';
  let event = '';
  let dateLabel = 'Imported';

  let pos = parseSfen(INITIAL_SFEN);
  let customBoardStarted = false;
  const customBoard: (Piece | null)[][] = Array.from({ length: 9 }, () =>
    Array<Piece | null>(9).fill(null),
  );
  let hasExplicitP = false;

  const moveLines: string[] = [];
  let terminalLine = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("'") || line.startsWith('V')) continue;
    if (line.startsWith('N+')) {
      senteName = line.slice(2).trim() || senteName;
    } else if (line.startsWith('N-')) {
      goteName = line.slice(2).trim() || goteName;
    } else if (line.startsWith('$EVENT:')) {
      event = line.slice(7).trim();
    } else if (line.startsWith('$START_TIME:')) {
      dateLabel = line.slice(12).trim().slice(0, 10) || dateLabel;
    } else if (line === 'PI') {
      pos = parseSfen(INITIAL_SFEN);
      hasExplicitP = false;
    } else if (/^P[1-9]/.test(line)) {
      customBoardStarted = true;
      hasExplicitP = true;
      const r = Number(line[1]) - 1;
      const rowBody = line.slice(2);
      for (let c = 0; c < 9; c++) {
        const token = rowBody.slice(c * 3, c * 3 + 3);
        if (!token || token.trim() === '*') continue;
        const side: Side = token[0] === '+' ? 'b' : 'w';
        const pCode = token.slice(1, 3);
        const pType = CSA_PIECE_MAP[pCode];
        if (pType) customBoard[r][c] = { type: pType, side };
      }
    } else if ((line.startsWith('P+') || line.startsWith('P-')) && line.length >= 6) {
      if (customBoardStarted) {
        pos.board = customBoard;
      }
      const side: Side = line[1] === '+' ? 'b' : 'w';
      const rest = line.slice(2);
      for (let i = 0; i + 3 < rest.length; i += 4) {
        const sq = rest.slice(i, i + 2);
        const pCode = rest.slice(i + 2, i + 4);
        const pType = CSA_PIECE_MAP[pCode];
        if (!pType) continue;
        if (sq === '00') {
          const base = basePieceType(pType);
          if (base !== 'K') pos.hands[side][base]++;
        } else {
          const col = 9 - Number(sq[0]);
          const row = Number(sq[1]) - 1;
          if (row >= 0 && row < 9 && col >= 0 && col < 9) {
            pos.board[row][col] = { type: pType, side };
          }
        }
      }
    } else if (line === '+' || line === '-') {
      if (hasExplicitP && customBoardStarted) {
        pos.board = customBoard;
      }
      pos.turn = line === '+' ? 'b' : 'w';
    } else if (/^[+-]\d{4}[A-Z]{2}/.test(line)) {
      moveLines.push(line.slice(0, 7));
    } else if (line.startsWith('%')) {
      terminalLine = line;
    }
  }

  if (hasExplicitP && customBoardStarted) {
    pos.board = customBoard;
  }

  const initialSfen = toSfen(pos);
  const movesUsi: string[] = [];
  const parseWarnings: string[] = [];
  let lastMover: Side | null = null;

  for (const mv of moveLines) {
    const turn: Side = mv[0] === '+' ? 'b' : 'w';
    if (pos.turn !== turn) pos.turn = turn;
    const fromCode = mv.slice(1, 3);
    const toCode = mv.slice(3, 5);
    const endPieceCode = mv.slice(5, 7);
    const endType = CSA_PIECE_MAP[endPieceCode];
    if (!endType) {
      parseWarnings.push(`Unknown CSA piece code: ${endPieceCode}`);
      break;
    }

    const toSq = parseOriginDigits(toCode);
    if (!toSq) break;

    const legal = generateLegalMoves(pos);
    let matched: ShogiMove | undefined;

    if (fromCode === '00') {
      matched = legal.find(
        (m) => m.drop && m.piece === endType && sameSquare(m.to, toSq),
      );
    } else {
      const fromSq = parseOriginDigits(fromCode);
      if (!fromSq) break;
      const originPiece = pos.board[fromSq.row][fromSq.col];
      const shouldPromote = originPiece ? originPiece.type !== endType : false;
      matched = legal.find(
        (m) =>
          !m.drop &&
          sameSquare(m.from, fromSq) &&
          sameSquare(m.to, toSq) &&
          Boolean(m.promote) === shouldPromote,
      );
    }

    if (!matched) {
      parseWarnings.push(`Illegal or unrecognized CSA move: ${mv}`);
      break;
    }
    movesUsi.push(matched.usi);
    lastMover = pos.turn;
    pos = applyMove(pos, matched);
  }

  const title = event ? `${event}: ${senteName} vs ${goteName}` : `${senteName} vs ${goteName}`;
  return {
    id: `db-csa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    format: 'csa',
    title: title === 'Sente vs Gote' ? fallbackTitle : title,
    event: event || undefined,
    senteName,
    goteName,
    result: detectResultFromText(terminalLine, lastMover),
    dateLabel,
    initialSfen,
    movesUsi,
    rawSource: chunk,
    parseWarnings: parseWarnings.length ? parseWarnings : undefined,
  };
}

export function parseCsaDatabase(content: string, fallbackTitle = 'CSA Game'): ParsedDatabaseGame[] {
  const chunks = content
    .replace(/\r\n?/g, '\n')
    .split(/^\s*\/\s*$/m)
    .map((c) => c.trim())
    .filter(Boolean);

  if (chunks.length === 0) return [];
  return chunks.map((chunk, idx) =>
    parseSingleCsaGame(chunk, chunks.length > 1 ? `${fallbackTitle} #${idx + 1}` : fallbackTitle),
  );
}

export function parseSfenDatabase(content: string, fallbackTitle = 'SFEN Position'): ParsedDatabaseGame[] {
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

  const games: ParsedDatabaseGame[] = [];

  lines.forEach((rawLine, idx) => {
    let title = lines.length > 1 ? `${fallbackTitle} #${idx + 1}` : fallbackTitle;
    let line = rawLine;

    // Optional "Title | sfen ..." format
    if (line.includes('|')) {
      const [left, right] = line.split('|', 2);
      if (right.includes('/')) {
        title = left.trim() || title;
        line = right.trim();
      }
    }

    let sfenStr = INITIAL_SFEN;
    let movesUsi: string[] = [];

    if (line.startsWith('position ')) {
      const movesSplit = line.split(/\bmoves\b/);
      const head = movesSplit[0].replace(/^position\s+/, '').trim();
      if (head.startsWith('sfen ')) {
        sfenStr = head.replace(/^sfen\s+/, '').trim();
      } else if (head === 'startpos') {
        sfenStr = INITIAL_SFEN;
      }
      if (movesSplit[1]) {
        movesUsi = movesSplit[1].trim().split(/\s+/).filter(Boolean);
      }
    } else {
      const cleanLine = line.replace(/^sfen\s+/, '').trim();
      const parts = cleanLine.split(/\s+/);
      // Standard SFEN has 3 or 4 parts before optional moves
      if (parts.length >= 3 && parts[0].includes('/')) {
        const hasMoveNum = /^\d+$/.test(parts[3] ?? '');
        const sfenLen = hasMoveNum ? 4 : 3;
        sfenStr = parts.slice(0, sfenLen).join(' ');
        if (parts.length > sfenLen) {
          const rest = parts.slice(sfenLen);
          movesUsi = rest[0] === 'moves' ? rest.slice(1) : rest;
        }
      }
    }

    try {
      let pos = parseSfen(sfenStr);
      const validMoves: string[] = [];
      for (const usi of movesUsi) {
        const found = findLegalMoveByUsi(pos, usi);
        if (!found) break;
        validMoves.push(found.usi);
        pos = applyMove(pos, found);
      }

      games.push({
        id: `db-sfen-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        format: 'sfen',
        title,
        senteName: 'Sente',
        goteName: 'Gote',
        result: '*',
        dateLabel: 'SFEN',
        initialSfen: toSfen(parseSfen(sfenStr)),
        movesUsi: validMoves,
        rawSource: rawLine,
      });
    } catch {
      // Skip invalid SFEN line
    }
  });

  return games;
}

export function detectShogiFileFormat(filename: string, content: string): DatabaseFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.kif')) return 'kif';
  if (lower.endsWith('.ki2')) return 'ki2';
  if (lower.endsWith('.csa')) return 'csa';
  if (lower.endsWith('.sfen') || lower.endsWith('.usi')) return 'sfen';

  const trimmed = content.trim();
  if (/^V2|^\$EVENT:|^N[+-]|^[+-]\d{4}[A-Z]{2}/m.test(trimmed)) return 'csa';
  if (/^\d+\s+[１-９1-9同]/m.test(trimmed) || trimmed.includes('手合割：')) return 'kif';
  if (/[▲△▽☗☖][１-９1-9同]/.test(trimmed)) return 'ki2';
  return 'sfen';
}

export function parseDatabaseImport(
  content: string,
  filename = '',
  forcedFormat?: DatabaseFormat,
): ParsedDatabaseGame[] {
  const format = forcedFormat ?? detectShogiFileFormat(filename, content);
  const baseTitle = filename.replace(/\.[^.]+$/, '') || `Imported ${format.toUpperCase()}`;

  switch (format) {
    case 'kif':
      return [parseKifText(content, baseTitle)];
    case 'ki2':
      return [parseKi2Text(content, baseTitle)];
    case 'csa':
      return parseCsaDatabase(content, baseTitle);
    case 'sfen':
      return parseSfenDatabase(content, baseTitle);
  }
}

/**
 * Decodes uploaded binary file buffer, falling back from UTF-8 to Shift-JIS if Japanese mojibake occurs.
 */
export function decodeShogiTextBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('shift_jis').decode(buffer);
  } catch {
    return utf8;
  }
}
