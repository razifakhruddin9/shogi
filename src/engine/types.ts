export type Side = 'b' | 'w'; // 'b' = Sente (▲ Black), 'w' = Gote (△ White)

export type BasePieceType = 'K' | 'R' | 'B' | 'G' | 'S' | 'N' | 'L' | 'P';

export type PieceType =
  | BasePieceType
  | '+R'
  | '+B'
  | '+S'
  | '+N'
  | '+L'
  | '+P';

export interface Piece {
  type: PieceType;
  side: Side;
}

export type HandCounts = Record<Exclude<BasePieceType, 'K'>, number>;

export interface ShogiPosition {
  board: (Piece | null)[][]; // [row 0..8][col 0..8], row 0 = rank 1, col 0 = file 9
  hands: {
    b: HandCounts;
    w: HandCounts;
  };
  turn: Side;
  moveNumber: number;
}

export interface Square {
  row: number;
  col: number;
}

export interface ShogiMove {
  from?: Square; // undefined for drops
  to: Square;
  piece: PieceType; // moving piece type (before promotion) or dropped base piece
  promote?: boolean;
  drop?: boolean;
  captured?: PieceType;
  usi: string; // e.g. 7g7f, 2b3c+, P*5e
  kifu: string; // e.g. ▲7六歩, △3四歩
  western: string; // e.g. P-7f, Bx3c+, P*5e
}

export type GameStatus =
  | 'playing'
  | 'checkmate'
  | 'resigned'
  | 'timeout'
  | 'sennichite';

export interface GameResult {
  status: GameStatus;
  winner?: Side | 'draw';
  reason: string;
}

export interface EngineEvaluation {
  scoreCp: number; // from Sente ('b') perspective in centipawns (positive = Sente better)
  mateIn?: number; // positive = Sente mates in N, negative = Gote mates in N
  bestMove?: ShogiMove;
  pv: string[];
  depth: number;
  nodes: number;
}

export const INITIAL_SFEN =
  'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1';

export const HAND_ORDER: Exclude<BasePieceType, 'K'>[] = [
  'R',
  'B',
  'G',
  'S',
  'N',
  'L',
  'P',
];

export const PIECE_KANJI: Record<PieceType, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
  '+R': '龍',
  '+B': '馬',
  '+S': '全',
  '+N': '圭',
  '+L': '杏',
  '+P': 'と',
};

export const PIECE_NAME_EN: Record<PieceType, string> = {
  K: 'King',
  R: 'Rook',
  B: 'Bishop',
  G: 'Gold',
  S: 'Silver',
  N: 'Knight',
  L: 'Lance',
  P: 'Pawn',
  '+R': 'Dragon',
  '+B': 'Horse',
  '+S': 'Prom. Silver',
  '+N': 'Prom. Knight',
  '+L': 'Prom. Lance',
  '+P': 'Tokin',
};

export const PIECE_SHORT_EN: Record<PieceType, string> = {
  K: 'K',
  R: 'R',
  B: 'B',
  G: 'G',
  S: 'S',
  N: 'N',
  L: 'L',
  P: 'P',
  '+R': '+R',
  '+B': '+B',
  '+S': '+S',
  '+N': '+N',
  '+L': '+L',
  '+P': '+P',
};
