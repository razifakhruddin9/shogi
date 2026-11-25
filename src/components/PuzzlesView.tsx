import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Puzzle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { PUZZLE_LEVELS, SHOGI_PUZZLES } from '../data/puzzles';
import { parseSfen } from '../engine/sfen';
import { applyMove, findLegalMoveByUsi, generateLegalMoves } from '../engine/shogi';
import {
  BasePieceType,
  HAND_ORDER,
  PieceType,
  ShogiMove,
  ShogiPosition,
  Square,
} from '../engine/types';
import { ShogiPieceSvg } from './ShogiPieceSvg';

interface PuzzlesViewProps {
  boardTheme: 'kaya' | 'walnut';
  showEnglishHints: boolean;
}

const FILES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const RANKS_JP = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SOLVED_STORAGE_KEY = 'shogi_studio_puzzles_solved_v1';

export const PuzzlesView: React.FC<PuzzlesViewProps> = ({
  boardTheme,
  showEnglishHints,
}) => {
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const puzzle = SHOGI_PUZZLES[puzzleIdx];
  const levelMeta =
    PUZZLE_LEVELS.find((l) => l.level === puzzle.level) ?? PUZZLE_LEVELS[0];

  const [pos, setPos] = useState<ShogiPosition>(() => parseSfen(puzzle.sfen));
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<'solving' | 'solved' | 'wrong' | 'timeout'>(
    'solving',
  );
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [solvedIds, setSolvedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SOLVED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [byoyomiLeft, setByoyomiLeft] = useState<number | null>(
    levelMeta.byoyomiSeconds ?? null,
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [selectedHand, setSelectedHand] = useState<Exclude<BasePieceType, 'K'> | null>(
    null,
  );
  const [pendingPromo, setPendingPromo] = useState<{
    normal: ShogiMove;
    promoted: ShogiMove;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(solvedIds));
    } catch {
      // ignore storage quota errors
    }
  }, [solvedIds]);

  // Level 6 Byoyomi countdown timer
  useEffect(() => {
    if (byoyomiLeft === null || status !== 'solving') return;
    if (byoyomiLeft <= 0) {
      setStatus('timeout');
      setStreak(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setByoyomiLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [byoyomiLeft, status]);

  const loadPuzzle = (idx: number) => {
    const p = SHOGI_PUZZLES[idx];
    const meta = PUZZLE_LEVELS.find((l) => l.level === p.level);
    setPuzzleIdx(idx);
    setPos(parseSfen(p.sfen));
    setStepIdx(0);
    setStatus('solving');
    setShowHint(false);
    setSelectedSquare(null);
    setSelectedHand(null);
    setPendingPromo(null);
    setByoyomiLeft(meta?.byoyomiSeconds ?? null);
  };

  const legalMoves = useMemo(
    () => (status === 'solving' ? generateLegalMoves(pos) : []),
    [pos, status],
  );

  const legalTargets = useMemo(() => {
    const map = new Map<string, ShogiMove[]>();
    for (const m of legalMoves) {
      if (selectedHand && m.drop && m.piece === selectedHand) {
        const k = `${m.to.row}-${m.to.col}`;
        map.set(k, [...(map.get(k) ?? []), m]);
      } else if (
        selectedSquare &&
        !m.drop &&
        m.from?.row === selectedSquare.row &&
        m.from?.col === selectedSquare.col
      ) {
        const k = `${m.to.row}-${m.to.col}`;
        map.set(k, [...(map.get(k) ?? []), m]);
      }
    }
    return map;
  }, [legalMoves, selectedHand, selectedSquare]);

  const tryMove = (move: ShogiMove) => {
    setPendingPromo(null);
    setSelectedSquare(null);
    setSelectedHand(null);

    const expectedUsi = puzzle.solutionUsi[stepIdx];
    if (move.usi !== expectedUsi) {
      setStatus('wrong');
      setStreak(0);
      return;
    }

    const afterUser = applyMove(pos, move);
    const nextStep = stepIdx + 1;

    if (nextStep >= puzzle.solutionUsi.length) {
      setPos(afterUser);
      setStepIdx(nextStep);
      setStatus('solved');
      setStreak((s) => s + 1);
      if (!solvedIds.includes(puzzle.id)) {
        setSolvedIds((prev) => [...prev, puzzle.id]);
      }
      return;
    }

    const replyUsi = puzzle.solutionUsi[nextStep];
    const replyMove = findLegalMoveByUsi(afterUser, replyUsi);
    if (replyMove) {
      setPos(afterUser);
      window.setTimeout(() => {
        setPos(applyMove(afterUser, replyMove));
        setStepIdx(nextStep + 1);
      }, 260);
    } else {
      setPos(afterUser);
      setStepIdx(nextStep);
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (status !== 'solving' || pendingPromo) return;
    const matches = legalTargets.get(`${r}-${c}`);
    if (matches && matches.length > 0) {
      if (matches.length === 1) tryMove(matches[0]);
      else {
        setPendingPromo({
          normal: matches.find((m) => !m.promote)!,
          promoted: matches.find((m) => m.promote)!,
        });
      }
      return;
    }
    const cell = pos.board[r][c];
    if (cell && cell.side === pos.turn) {
      setSelectedHand(null);
      setSelectedSquare(
        selectedSquare?.row === r && selectedSquare?.col === c ? null : { row: r, col: c },
      );
    } else {
      setSelectedSquare(null);
      setSelectedHand(null);
    }
  };

  return (
    <div className="puzzles-layout">
      <aside className="repertoire-sidebar">
        <div className="panel-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Puzzle size={15} className="accent-icon" />
            <span>Puzzle Level 1–6</span>
          </div>
          <span className="mono-pill">
            {solvedIds.length}/{SHOGI_PUZZLES.length}
          </span>
        </div>

        <div className="puzzle-stats-strip">
          <div className="stat-box">
            <Flame size={15} className="warn-text" />
            <span>Streak: {streak}</span>
          </div>
          <div className="stat-box">
            <CheckCircle2 size={15} className="win-text" />
            <span>Level {puzzle.level} / 6</span>
          </div>
        </div>

        <div className="repertoire-list">
          {SHOGI_PUZZLES.map((p, idx) => {
            const isSolved = solvedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`repertoire-item ${idx === puzzleIdx ? 'active' : ''}`}
                onClick={() => loadPuzzle(idx)}
              >
                <div className="rep-item-top">
                  <span className="rep-code">
                    Level {p.level} • {p.rating}
                  </span>
                  <span className="rep-cat">
                    {isSolved ? <span className="win-text">✓ Solved</span> : `Mate ${p.movesToMate}`}
                  </span>
                </div>
                <div className="rep-name">{p.title}</div>
                <div className="rep-jp">{p.theme}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="repertoire-center">
        <div className="puzzle-board-stack">
          <div className={`shogi-board-frame theme-${boardTheme}`}>
            <div className="board-coords-top">
              {FILES.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <div className="board-and-ranks">
              <div className={`shogi-grid theme-${boardTheme}`}>
                {pos.board.map((row, r) =>
                  row.map((cell, c) => {
                    const isDark = (r + c) % 2 === 1;
                    const isSel = selectedSquare?.row === r && selectedSquare?.col === c;
                    const isTarget = legalTargets.has(`${r}-${c}`);
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        className={`shogi-cell ${isDark ? 'dark-sq' : 'light-sq'} ${
                          isSel ? 'selected-sq' : ''
                        }`}
                        onClick={() => handleCellClick(r, c)}
                      >
                        {cell && (
                          <ShogiPieceSvg
                            type={cell.type}
                            side={cell.side}
                            showEnglishHint={showEnglishHints}
                          />
                        )}
                        {isTarget && (
                          <span className={`legal-marker ${cell ? 'capture-ring' : 'move-dot'}`} />
                        )}
                      </button>
                    );
                  }),
                )}

                {pendingPromo && (
                  <div className="promotion-overlay">
                    <div className="promotion-card">
                      <span className="promo-title">Promote?</span>
                      <div className="promo-choices">
                        <button
                          type="button"
                          className="promo-btn promote"
                          onClick={() => tryMove(pendingPromo.promoted)}
                        >
                          <div className="promo-piece-preview">
                            <ShogiPieceSvg
                              type={`+${pendingPromo.promoted.piece}` as PieceType}
                              side={pos.turn}
                              showEnglishHint={showEnglishHints}
                            />
                          </div>
                          <span>Promote</span>
                        </button>
                        <button
                          type="button"
                          className="promo-btn"
                          onClick={() => tryMove(pendingPromo.normal)}
                        >
                          <div className="promo-piece-preview">
                            <ShogiPieceSvg
                              type={pendingPromo.normal.piece}
                              side={pos.turn}
                              showEnglishHint={showEnglishHints}
                            />
                          </div>
                          <span>Keep</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="board-coords-right">
                {RANKS_JP.map((rk) => (
                  <span key={rk}>{rk}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Sente Komadai Strip for Tsume Drops */}
          <div className="puzzle-hand-bar">
            <span className="komadai-label">▲ Bidak di Tangan (Klik untuk Drop):</span>
            <div className="puzzle-hand-pieces">
              {HAND_ORDER.map((pType) => {
                const count = pos.hands.b[pType];
                if (count === 0) return null;
                return (
                  <button
                    key={pType}
                    type="button"
                    className={`komadai-item ${selectedHand === pType ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedSquare(null);
                      setSelectedHand((prev) => (prev === pType ? null : pType));
                    }}
                  >
                    <div className="komadai-piece-icon">
                      <ShogiPieceSvg
                        type={pType}
                        side="b"
                        showEnglishHint={showEnglishHints}
                        size="hand"
                      />
                    </div>
                    {count > 1 && <span className="komadai-count">{count}</span>}
                  </button>
                );
              })}
              {HAND_ORDER.every((p) => pos.hands.b[p] === 0) && (
                <span className="komadai-empty">Kosong</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="repertoire-inspector">
        <div className="panel-section-header">
          <div>
            <div className="rep-inspector-level">
              Level {levelMeta.level} • {levelMeta.category}
            </div>
            <div className="rep-inspector-title">{puzzle.title}</div>
          </div>
          {byoyomiLeft !== null ? (
            <span
              className={`byoyomi-pill mono ${
                byoyomiLeft <= 10 ? 'critical' : byoyomiLeft <= 20 ? 'low' : ''
              }`}
            >
              <Clock size={11} />
              <span>{byoyomiLeft}s</span>
            </span>
          ) : (
            <span className="mono-pill">{levelMeta.sublabel}</span>
          )}
        </div>

        <div className="puzzle-curriculum-box">
          <div className="curriculum-row">
            <strong>Fokus Kognitif:</strong> {levelMeta.cognitiveFocus}
          </div>
          <div className="curriculum-row">
            <strong>Relevansi Strategi:</strong> {levelMeta.realWorldRelevance}
          </div>
        </div>

        {status === 'solved' && (
          <div className="puzzle-feedback success">
            <CheckCircle2 size={18} />
            <div>
              <strong>Level {puzzle.level} Selesai!</strong>
              <div>Rangkaian skakmat selesai dengan presisi.</div>
            </div>
          </div>
        )}

        {(status === 'wrong' || status === 'timeout') && (
          <div className="puzzle-feedback error">
            <XCircle size={18} />
            <div>
              <strong>
                {status === 'timeout' ? 'Waktu Byoyomi Habis' : 'Bukan Langkah Solusi'}
              </strong>
              <div>Tekan Retry Puzzle untuk mencoba urutan langkah lagi.</div>
            </div>
          </div>
        )}

        {showHint && (
          <div className="puzzle-hint-box">
            <strong>Hint:</strong> {puzzle.hint}
          </div>
        )}

        <div className="puzzle-btn-col">
          <button
            type="button"
            className="action-pill-btn"
            onClick={() => setShowHint((h) => !h)}
          >
            <HelpCircle size={14} />
            <span>{showHint ? 'Sembunyikan Hint' : 'Tampilkan Hint'}</span>
          </button>

          <button
            type="button"
            className="action-pill-btn"
            onClick={() => loadPuzzle(puzzleIdx)}
          >
            <RotateCcw size={14} />
            <span>Retry Puzzle</span>
          </button>

          {puzzleIdx < SHOGI_PUZZLES.length - 1 && (
            <button
              type="button"
              className="primary-solid-btn full-width"
              onClick={() => loadPuzzle(puzzleIdx + 1)}
            >
              Puzzle Berikutnya →
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};
