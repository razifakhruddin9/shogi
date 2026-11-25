import {
  basePieceType,
  canPromoteType,
  clonePosition,
  isPromoted,
  promotePieceType,
} from './sfen';
import {
  BasePieceType,
  HAND_ORDER,
  PIECE_KANJI,
  PIECE_SHORT_EN,
  PieceType,
  ShogiMove,
  ShogiPosition,
  Side,
  Square,
} from './types';

const KANJI_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const RANK_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

export function squareToUsi(sq: Square): string {
  const file = 9 - sq.col;
  const rank = RANK_LETTERS[sq.row];
  return `${file}${rank}`;
}

export function usiToSquare(usi: string): Square {
  const file = Number(usi[0]);
  const rank = RANK_LETTERS.indexOf(usi[1]);
  return { row: rank, col: 9 - file };
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 9 && c >= 0 && c < 9;
}

export function isPromotionZone(side: Side, row: number): boolean {
  return side === 'b' ? row <= 2 : row >= 6;
}

export function mustPromote(type: PieceType, side: Side, toRow: number): boolean {
  if (type === 'P' || type === 'L') {
    return side === 'b' ? toRow === 0 : toRow === 8;
  }
  if (type === 'N') {
    return side === 'b' ? toRow <= 1 : toRow >= 7;
  }
  return false;
}

export function opponentOf(side: Side): Side {
  return side === 'b' ? 'w' : 'b';
}

function getStepDeltas(type: PieceType, side: Side): [number, number][] {
  const dir = side === 'b' ? -1 : 1;
  switch (type) {
    case 'P':
      return [[dir, 0]];
    case 'N':
      return [
        [2 * dir, -1],
        [2 * dir, 1],
      ];
    case 'S':
      return [
        [dir, -1],
        [dir, 0],
        [dir, 1],
        [-dir, -1],
        [-dir, 1],
      ];
    case 'G':
    case '+S':
    case '+N':
    case '+L':
    case '+P':
      return [
        [dir, -1],
        [dir, 0],
        [dir, 1],
        [0, -1],
        [0, 1],
        [-dir, 0],
      ];
    case 'K':
      return [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
    case '+R':
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    case '+B':
      return [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    default:
      return [];
  }
}

function getSlideDeltas(type: PieceType, side: Side): [number, number][] {
  const dir = side === 'b' ? -1 : 1;
  switch (type) {
    case 'L':
      return [[dir, 0]];
    case 'R':
    case '+R':
      return [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
    case 'B':
    case '+B':
      return [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
    default:
      return [];
  }
}

export function findKing(pos: ShogiPosition, side: Side): Square | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = pos.board[r][c];
      if (cell && cell.side === side && cell.type === 'K') {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

/**
 * Checks whether square (targetRow, targetCol) is attacked by any piece of `attackerSide`.
 */
export function isSquareAttacked(
  pos: ShogiPosition,
  targetRow: number,
  targetCol: number,
  attackerSide: Side,
): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = pos.board[r][c];
      if (!piece || piece.side !== attackerSide) continue;

      const steps = getStepDeltas(piece.type, attackerSide);
      for (const [dr, dc] of steps) {
        if (r + dr === targetRow && c + dc === targetCol) {
          return true;
        }
      }

      const slides = getSlideDeltas(piece.type, attackerSide);
      for (const [dr, dc] of slides) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          if (nr === targetRow && nc === targetCol) return true;
          if (pos.board[nr][nc] !== null) break;
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return false;
}

export function isInCheck(pos: ShogiPosition, side: Side): boolean {
  const king = findKing(pos, side);
  if (!king) return false;
  return isSquareAttacked(pos, king.row, king.col, opponentOf(side));
}

function formatMoveStrings(
  side: Side,
  piece: PieceType,
  to: Square,
  from: Square | undefined,
  promote: boolean,
  captured: PieceType | undefined,
  drop: boolean,
): { usi: string; kifu: string; western: string } {
  const toFile = 9 - to.col;
  const toRankKanji = KANJI_NUMERALS[to.row];
  const toRankLetter = RANK_LETTERS[to.row];
  const sideGlyph = side === 'b' ? '▲' : '△';
  const kanji = PIECE_KANJI[piece];
  const shortEn = PIECE_SHORT_EN[piece];

  if (drop) {
    const usi = `${piece}*${squareToUsi(to)}`;
    const kifu = `${sideGlyph}${toFile}${toRankKanji}${kanji}打`;
    const western = `${shortEn}*${toFile}${toRankLetter}`;
    return { usi, kifu, western };
  }

  const fromUsi = squareToUsi(from!);
  const toUsi = squareToUsi(to);
  const usi = `${fromUsi}${toUsi}${promote ? '+' : ''}`;
  const promoKifu = promote ? '成' : '';
  const kifu = `${sideGlyph}${toFile}${toRankKanji}${kanji}${promoKifu}`;
  const action = captured ? 'x' : '-';
  const western = `${shortEn}${action}${toFile}${toRankLetter}${promote ? '+' : ''}`;
  return { usi, kifu, western };
}

export function applyMoveMut(pos: ShogiPosition, move: ShogiMove): void {
  const side = pos.turn;
  if (move.drop) {
    const base = move.piece as Exclude<BasePieceType, 'K'>;
    pos.hands[side][base]--;
    pos.board[move.to.row][move.to.col] = { type: base, side };
  } else {
    const from = move.from!;
    const moving = pos.board[from.row][from.col]!;
    const target = pos.board[move.to.row][move.to.col];
    if (target) {
      const capBase = basePieceType(target.type);
      if (capBase !== 'K') {
        pos.hands[side][capBase]++;
      }
    }
    pos.board[from.row][from.col] = null;
    const finalType = move.promote ? promotePieceType(moving.type) : moving.type;
    pos.board[move.to.row][move.to.col] = { type: finalType, side };
  }
  pos.turn = opponentOf(side);
  pos.moveNumber += 1;
}

export function applyMove(pos: ShogiPosition, move: ShogiMove): ShogiPosition {
  const next = clonePosition(pos);
  applyMoveMut(next, move);
  return next;
}

function generatePseudoBoardMoves(pos: ShogiPosition, side: Side): ShogiMove[] {
  const moves: ShogiMove[] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = pos.board[r][c];
      if (!piece || piece.side !== side) continue;

      const targets: Square[] = [];
      for (const [dr, dc] of getStepDeltas(piece.type, side)) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const occ = pos.board[nr][nc];
        if (!occ || occ.side !== side) targets.push({ row: nr, col: nc });
      }
      for (const [dr, dc] of getSlideDeltas(piece.type, side)) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const occ = pos.board[nr][nc];
          if (!occ) {
            targets.push({ row: nr, col: nc });
          } else {
            if (occ.side !== side) targets.push({ row: nr, col: nc });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      const from: Square = { row: r, col: c };
      const inZoneFrom = isPromotionZone(side, r);

      for (const to of targets) {
        const captured = pos.board[to.row][to.col]?.type;
        const eligiblePromo =
          canPromoteType(piece.type) &&
          (inZoneFrom || isPromotionZone(side, to.row));
        const forcedPromo = mustPromote(piece.type, side, to.row);

        if (!forcedPromo) {
          const strs = formatMoveStrings(side, piece.type, to, from, false, captured, false);
          moves.push({
            from,
            to,
            piece: piece.type,
            promote: false,
            drop: false,
            captured,
            ...strs,
          });
        }
        if (eligiblePromo) {
          const strs = formatMoveStrings(side, piece.type, to, from, true, captured, false);
          moves.push({
            from,
            to,
            piece: piece.type,
            promote: true,
            drop: false,
            captured,
            ...strs,
          });
        }
      }
    }
  }
  return moves;
}

function hasUnpromotedPawnOnFile(pos: ShogiPosition, side: Side, col: number): boolean {
  for (let r = 0; r < 9; r++) {
    const cell = pos.board[r][col];
    if (cell && cell.side === side && cell.type === 'P') {
      return true;
    }
  }
  return false;
}

function hasAnyLegalReplyWithoutUchifuzume(pos: ShogiPosition): boolean {
  const side = pos.turn;
  const pseudo = generatePseudoBoardMoves(pos, side);
  for (const m of pseudo) {
    const next = applyMove(pos, m);
    if (!isInCheck(next, side)) return true;
  }
  // Check drops too (non-pawn or pawn drops that evade check)
  for (const pType of HAND_ORDER) {
    if (pos.hands[side][pType] <= 0) continue;
    for (let r = 0; r < 9; r++) {
      if (mustPromote(pType, side, r)) continue;
      for (let c = 0; c < 9; c++) {
        if (pos.board[r][c] !== null) continue;
        if (pType === 'P' && hasUnpromotedPawnOnFile(pos, side, c)) continue;
        const strs = formatMoveStrings(side, pType, { row: r, col: c }, undefined, false, undefined, true);
        const dropMove: ShogiMove = {
          to: { row: r, col: c },
          piece: pType,
          drop: true,
          promote: false,
          ...strs,
        };
        const next = applyMove(pos, dropMove);
        if (!isInCheck(next, side)) return true;
      }
    }
  }
  return false;
}

/**
 * Generates all legal moves (board moves + piece drops) for `pos.turn`.
 */
export function generateLegalMoves(pos: ShogiPosition): ShogiMove[] {
  const side = pos.turn;
  const opp = opponentOf(side);
  const legal: ShogiMove[] = [];

  for (const m of generatePseudoBoardMoves(pos, side)) {
    const next = applyMove(pos, m);
    if (!isInCheck(next, side)) {
      legal.push(m);
    }
  }

  for (const pType of HAND_ORDER) {
    if (pos.hands[side][pType] <= 0) continue;
    for (let c = 0; c < 9; c++) {
      if (pType === 'P' && hasUnpromotedPawnOnFile(pos, side, c)) continue;
      for (let r = 0; r < 9; r++) {
        if (pos.board[r][c] !== null) continue;
        if (mustPromote(pType, side, r)) continue;

        const strs = formatMoveStrings(side, pType, { row: r, col: c }, undefined, false, undefined, true);
        const dropMove: ShogiMove = {
          to: { row: r, col: c },
          piece: pType,
          drop: true,
          promote: false,
          ...strs,
        };

        const next = applyMove(pos, dropMove);
        if (isInCheck(next, side)) continue;

        // Uchifuzume check: dropping a pawn directly in front of opponent's King
        // is illegal if it causes immediate checkmate.
        if (pType === 'P') {
          const oppKing = findKing(next, opp);
          const pawnCheckRow = side === 'b' ? r - 1 : r + 1;
          if (oppKing && oppKing.row === pawnCheckRow && oppKing.col === c) {
            if (!hasAnyLegalReplyWithoutUchifuzume(next)) {
              continue; // Illegal drop pawn mate!
            }
          }
        }

        legal.push(dropMove);
      }
    }
  }

  return legal;
}

export function findLegalMoveByUsi(
  pos: ShogiPosition,
  usi: string,
  cachedMoves?: ShogiMove[],
): ShogiMove | undefined {
  const moves = cachedMoves ?? generateLegalMoves(pos);
  return moves.find((m) => m.usi === usi);
}

const MATERIAL_VALUES: Record<PieceType, number> = {
  K: 15000,
  R: 1000,
  B: 850,
  G: 560,
  S: 510,
  N: 360,
  L: 340,
  P: 100,
  '+R': 1350,
  '+B': 1150,
  '+S': 580,
  '+N': 560,
  '+L': 550,
  '+P': 540,
};

export function getMaterialBalance(pos: ShogiPosition): {
  b: number;
  w: number;
  diff: number;
} {
  let b = 0;
  let w = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = pos.board[r][c];
      if (!cell || cell.type === 'K') continue;
      const val = Math.round(MATERIAL_VALUES[cell.type] / 100);
      if (cell.side === 'b') b += val;
      else w += val;
    }
  }
  for (const p of HAND_ORDER) {
    const val = Math.round(MATERIAL_VALUES[p] / 100);
    b += pos.hands.b[p] * val;
    w += pos.hands.w[p] * val;
  }
  return { b, w, diff: b - w };
}

export { isPromoted };
