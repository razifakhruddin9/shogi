import { describe, expect, it } from 'vitest';
import { createSampleDatabaseGames } from '../../data/databaseSamples';
import { SHOGI_PUZZLES } from '../../data/puzzles';
import { SHOGI_REPERTOIRE } from '../../data/repertoire';
import { INITIAL_RECENT_GAMES } from '../../data/sampleGames';
import { searchBestMove } from '../ai';
import { generateFullGameReview, REVIEW_CATEGORIES } from '../gameReview';
import { parseDatabaseImport } from '../kifuParser';
import { parseSfen, toSfen } from '../sfen';
import { applyMove, findLegalMoveByUsi, generateLegalMoves, isInCheck } from '../shogi';
import { INITIAL_SFEN } from '../types';

describe('Shogi Engine Core Rules', () => {
  it('parses and serializes initial SFEN identically', () => {
    const pos = parseSfen(INITIAL_SFEN);
    expect(toSfen(pos)).toBe(INITIAL_SFEN);
  });

  it('generates exactly 30 legal opening moves for Sente', () => {
    const pos = parseSfen(INITIAL_SFEN);
    const moves = generateLegalMoves(pos);
    // 9 pawns (9) + 2 lances? no, blocked by pawns.
    // 9 pawn pushes + 18 king/gold/silver/rook/bishop moves:
    // Actually in standard Shogi initial position there are 30 legal first moves!
    expect(moves.length).toBe(30);
  });

  it('enforces Nifu (no two unpromoted pawns on the same file)', () => {
    const pos = parseSfen('4k4/9/9/9/9/9/4P4/9/4K4 b P 1');
    const moves = generateLegalMoves(pos);
    const pawnDropsOnFile5 = moves.filter(
      (m) => m.drop && m.piece === 'P' && m.to.col === 4,
    );
    expect(pawnDropsOnFile5.length).toBe(0);

    // Dropping on file 4 (col 5) is allowed
    const pawnDropsOnFile4 = moves.filter(
      (m) => m.drop && m.piece === 'P' && m.to.col === 5,
    );
    expect(pawnDropsOnFile4.length).toBeGreaterThan(0);
  });

  it('allows pawn drop on a file that only has a promoted Tokin (+P)', () => {
    const pos = parseSfen('4k4/9/9/4+P4/9/9/9/9/4K4 b P 1');
    const moves = generateLegalMoves(pos);
    const drop5f = findLegalMoveByUsi(pos, 'P*5f', moves);
    expect(drop5f).toBeDefined();
  });

  it('enforces Uchifuzume (illegal drop pawn mate)', () => {
    // Gote king at 5a trapped by own pawns/pieces, Sente gold on 5c? Wait:
    // King at 5a, Sente Gold at 4b & 6b? Let's make an exact Uchifuzume:
    // King at 5a, Sente Gold at 4a? Wait: King at 5a, Gote lances/pawns or Sente Gold at 5c.
    // King 5a, Gold 4a? No, Gold at 5c covers 4b, 5b, 6b. If 4a and 6a are blocked by Gote pieces (e.g. Lances/Silvers) or Golds:
    // Let's put Gote King on 5a, Gote Lance on 4a and 6a, Sente Gold on 5c:
    // 5b is empty. Dropping P*5b gives checkmate because 5b is defended by Gold 5c,
    // 4a & 6a occupied, 4b & 6b attacked by Gold 5c!
    const sfen = '3lkl3/9/4G4/9/9/9/9/9/4K4 b P 1';
    const pos = parseSfen(sfen);
    const moves = generateLegalMoves(pos);
    const dropMate = findLegalMoveByUsi(pos, 'P*5b', moves);
    expect(dropMate).toBeUndefined();
  });

  it('allows dropping a Gold for immediate checkmate (Atamakin)', () => {
    const sfen = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
    const pos = parseSfen(sfen);
    const move = findLegalMoveByUsi(pos, 'G*5b');
    expect(move).toBeDefined();
    const after = applyMove(pos, move!);
    expect(isInCheck(after, 'w')).toBe(true);
    expect(generateLegalMoves(after).length).toBe(0);
  });

  it('forces promotion for Pawn reaching last rank', () => {
    const sfen = '4k4/P8/9/9/9/9/9/9/4K4 b - 1';
    const pos = parseSfen(sfen);
    const moves = generateLegalMoves(pos);
    expect(findLegalMoveByUsi(pos, '9b9a', moves)).toBeUndefined();
    expect(findLegalMoveByUsi(pos, '9b9a+', moves)).toBeDefined();
  });

  it('AI finds immediate mate-in-1 in Tsume position', () => {
    const sfen = '4k4/9/4P4/9/9/9/9/9/4K4 b G 1';
    const pos = parseSfen(sfen);
    const evalRes = searchBestMove(pos, { maxDepth: 2, timeLimitMs: 500, elo: 1800 });
    expect(evalRes.bestMove?.usi).toBe('G*5b');
  });

  it('validates all Tsume puzzle solution sequences (Levels 1-6) result in checkmate', () => {
    const levels = new Set(SHOGI_PUZZLES.map((p) => p.level));
    expect([1, 2, 3, 4, 5, 6].every((lvl) => levels.has(lvl as 1 | 2 | 3 | 4 | 5 | 6))).toBe(true);
    for (const p of SHOGI_PUZZLES) {
      let pos = parseSfen(p.sfen);
      for (const usi of p.solutionUsi) {
        const move = findLegalMoveByUsi(pos, usi);
        expect(move, `Puzzle ${p.id} move ${usi} should be legal`).toBeDefined();
        pos = applyMove(pos, move!);
      }
      expect(isInCheck(pos, pos.turn), `Puzzle ${p.id} should end in check`).toBe(true);
      const remaining = generateLegalMoves(pos);
      expect(
        remaining.length,
        `Puzzle ${p.id} should end in checkmate (got: ${remaining.map((m) => m.usi).join(', ')})`,
      ).toBe(0);
    }
  });

  it('validates all Joban, Chuban, and Shuban (Levels 1-5) repertoire lines are completely legal', () => {
    expect(SHOGI_REPERTOIRE.filter((l) => l.phase === 'joban').length).toBe(5);
    expect(SHOGI_REPERTOIRE.filter((l) => l.phase === 'chuban').length).toBe(5);
    expect(SHOGI_REPERTOIRE.filter((l) => l.phase === 'shuban').length).toBe(5);
    for (const line of SHOGI_REPERTOIRE) {
      let pos = parseSfen(line.initialSfen);
      for (const usi of line.movesUsi) {
        const move = findLegalMoveByUsi(pos, usi);
        expect(move, `Repertoire ${line.id} move ${usi} should be legal`).toBeDefined();
        pos = applyMove(pos, move!);
      }
    }
  });

  it('validates all sample recent games move sequences are legal', () => {
    for (const game of INITIAL_RECENT_GAMES) {
      let pos = parseSfen(game.initialSfen ?? INITIAL_SFEN);
      for (const usi of game.movesUsi) {
        const move = findLegalMoveByUsi(pos, usi);
        expect(move, `Sample game ${game.id} move ${usi} should be legal`).toBeDefined();
        pos = applyMove(pos, move!);
      }
    }
  });

  it('parses .kif, .ki2, .csa (multi-game), and .sfen database formats accurately', () => {
    const samples = createSampleDatabaseGames();
    expect(samples.map((g) => g.format)).toEqual(['kif', 'ki2', 'csa', 'sfen', 'sfen']);
    for (const g of samples) {
      expect(g.movesUsi.length).toBeGreaterThan(0);
      let pos = parseSfen(g.initialSfen);
      for (const usi of g.movesUsi) {
        const mv = findLegalMoveByUsi(pos, usi);
        expect(mv, `${g.format} move ${usi} should be legal`).toBeDefined();
        pos = applyMove(pos, mv!);
      }
    }

    // Multi-game CSA database separated by '/'
    const multiCsa = `V2.2
N+Alice
N-Bob
PI
+
+7776FU
-3334FU
%TORYO
/
V2.2
N+Carol
N-Dave
PI
+
+2726FU
-8384FU`;
    const csaGames = parseDatabaseImport(multiCsa, 'tournament.csa');
    expect(csaGames.length).toBe(2);
    expect(csaGames[0].senteName).toBe('Alice');
    expect(csaGames[0].movesUsi).toEqual(['7g7f', '3c3d']);
    expect(csaGames[0].result).toBe('0-1'); // last mover was Gote (-3334FU) before %TORYO
    expect(csaGames[1].senteName).toBe('Carol');
    expect(csaGames[1].movesUsi).toEqual(['2g2f', '8c8d']);
  });

  it('generates post-game review with 0-100 accuracy, phase skills, advantage graph, and 9 move categories', async () => {
    const line = ['7g7f', '8c8d', '7i6h', '3c3d'];
    const positions = [parseSfen(INITIAL_SFEN)];
    const moves = [];
    for (const usi of line) {
      const cur = positions[positions.length - 1];
      const mv = findLegalMoveByUsi(cur, usi)!;
      moves.push(mv);
      positions.push(applyMove(cur, mv));
    }
    const review = await generateFullGameReview({
      initialSfen: INITIAL_SFEN,
      moves,
      positions,
      usiReady: false,
      senteElo: 1580,
      goteElo: 1600,
    });
    expect(review.senteAccuracy).toBeGreaterThanOrEqual(0);
    expect(review.senteAccuracy).toBeLessThanOrEqual(100);
    expect(review.goteAccuracy).toBeGreaterThanOrEqual(0);
    expect(review.goteAccuracy).toBeLessThanOrEqual(100);
    expect(review.plies.length).toBe(line.length + 1);
    expect(review.senteSkill.estimatedElo).toBeGreaterThan(0);
    expect(REVIEW_CATEGORIES.length).toBe(9);
    expect(review.senteCounts.book).toBeGreaterThanOrEqual(1);
  });
});
