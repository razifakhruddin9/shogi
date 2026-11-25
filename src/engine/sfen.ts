import {
  BasePieceType,
  HandCounts,
  INITIAL_SFEN,
  Piece,
  PieceType,
  ShogiPosition,
  Side,
} from './types';

export function emptyHand(): HandCounts {
  return { R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 };
}

export function clonePosition(pos: ShogiPosition): ShogiPosition {
  return {
    board: pos.board.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    hands: {
      b: { ...pos.hands.b },
      w: { ...pos.hands.w },
    },
    turn: pos.turn,
    moveNumber: pos.moveNumber,
  };
}

export function basePieceType(type: PieceType): BasePieceType {
  return (type.startsWith('+') ? type.slice(1) : type) as BasePieceType;
}

export function promotePieceType(type: PieceType): PieceType {
  if (type.startsWith('+') || type === 'K' || type === 'G') return type;
  return `+${type}` as PieceType;
}

export function isPromoted(type: PieceType): boolean {
  return type.startsWith('+');
}

export function canPromoteType(type: PieceType): boolean {
  return !isPromoted(type) && type !== 'K' && type !== 'G';
}

export function parseSfen(sfen: string = INITIAL_SFEN): ShogiPosition {
  const parts = sfen.trim().split(/\s+/);
  if (parts.length < 3) {
    throw new Error(`Invalid SFEN: "${sfen}"`);
  }
  const [boardPart, turnPart, handPart, movePart] = parts;
  const ranks = boardPart.split('/');
  if (ranks.length !== 9) {
    throw new Error(`Invalid SFEN board ranks (${ranks.length}): "${sfen}"`);
  }

  const board: (Piece | null)[][] = Array.from({ length: 9 }, () =>
    Array<Piece | null>(9).fill(null),
  );

  for (let r = 0; r < 9; r++) {
    let c = 0;
    const rankStr = ranks[r];
    for (let i = 0; i < rankStr.length; i++) {
      const ch = rankStr[i];
      if (ch >= '1' && ch <= '9') {
        c += Number(ch);
      } else {
        let promoted = false;
        let pChar = ch;
        if (ch === '+') {
          promoted = true;
          i++;
          pChar = rankStr[i];
        }
        if (!pChar) throw new Error(`Invalid promoted piece in SFEN: "${sfen}"`);
        const side: Side = pChar === pChar.toUpperCase() ? 'b' : 'w';
        const upper = pChar.toUpperCase() as BasePieceType;
        if (!'KRBGSNLP'.includes(upper)) {
          throw new Error(`Unknown SFEN piece "${pChar}" in "${sfen}"`);
        }
        const type: PieceType = promoted ? promotePieceType(upper) : upper;
        if (c >= 9) throw new Error(`Rank ${r + 1} overflow in SFEN: "${sfen}"`);
        board[r][c] = { type, side };
        c++;
      }
    }
    if (c !== 9) {
      throw new Error(`Rank ${r + 1} has ${c} files instead of 9 in SFEN: "${sfen}"`);
    }
  }

  const turn: Side = turnPart === 'w' ? 'w' : 'b';
  const hands = { b: emptyHand(), w: emptyHand() };

  if (handPart !== '-') {
    let countStr = '';
    for (const ch of handPart) {
      if (ch >= '0' && ch <= '9') {
        countStr += ch;
      } else {
        const count = countStr ? Number(countStr) : 1;
        countStr = '';
        const side: Side = ch === ch.toUpperCase() ? 'b' : 'w';
        const upper = ch.toUpperCase();
        if (!'RBGSNLP'.includes(upper)) {
          throw new Error(`Invalid hand piece "${ch}" in SFEN: "${sfen}"`);
        }
        const key = upper as Exclude<BasePieceType, 'K'>;
        hands[side][key] += count;
      }
    }
  }

  const moveNumber = movePart ? Math.max(1, Number(movePart) || 1) : 1;
  return { board, hands, turn, moveNumber };
}

export function toSfen(pos: ShogiPosition, includeMoveNumber = true): string {
  const rankStrings: string[] = [];
  for (let r = 0; r < 9; r++) {
    let rowStr = '';
    let empty = 0;
    for (let c = 0; c < 9; c++) {
      const cell = pos.board[r][c];
      if (!cell) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += String(empty);
          empty = 0;
        }
        const promo = cell.type.startsWith('+') ? '+' : '';
        const base = basePieceType(cell.type);
        rowStr += promo + (cell.side === 'b' ? base : base.toLowerCase());
      }
    }
    if (empty > 0) rowStr += String(empty);
    rankStrings.push(rowStr);
  }

  const handOrder: Exclude<BasePieceType, 'K'>[] = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
  let handStr = '';
  for (const p of handOrder) {
    const n = pos.hands.b[p];
    if (n > 0) handStr += (n > 1 ? String(n) : '') + p;
  }
  for (const p of handOrder) {
    const n = pos.hands.w[p];
    if (n > 0) handStr += (n > 1 ? String(n) : '') + p.toLowerCase();
  }
  if (!handStr) handStr = '-';

  const base = `${rankStrings.join('/')} ${pos.turn} ${handStr}`;
  return includeMoveNumber ? `${base} ${pos.moveNumber}` : base;
}

export function positionRepetitionKey(pos: ShogiPosition): string {
  return toSfen(pos, false);
}
