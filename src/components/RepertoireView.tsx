import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import {
  JosekiLine,
  REPERTOIRE_PHASES,
  RepertoirePhase,
  SHOGI_REPERTOIRE,
} from '../data/repertoire';
import { parseSfen } from '../engine/sfen';
import { applyMove, findLegalMoveByUsi } from '../engine/shogi';
import { HAND_ORDER, ShogiMove, ShogiPosition, Side } from '../engine/types';
import { useI18n } from '../i18n';
import { ShogiPieceSvg } from './ShogiPieceSvg';

interface RepertoireViewProps {
  boardTheme: 'kaya' | 'walnut';
  showEnglishHints: boolean;
  notationMode: 'kifu' | 'western';
  onSendToAnalysis: (
    title: string,
    movesUsi: string[],
    initialSfen?: string,
  ) => void;
}

const FILES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const RANKS_JP = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PROGRESS_STORAGE_KEY = 'shogi_studio_repertoire_done_v1';

export const RepertoireView: React.FC<RepertoireViewProps> = ({
  boardTheme,
  showEnglishHints,
  notationMode,
  onSendToAnalysis,
}) => {
  const { t } = useI18n();
  const [activePhase, setActivePhase] = useState<RepertoirePhase>('joban');
  const [selectedLine, setSelectedLine] = useState<JosekiLine>(
    SHOGI_REPERTOIRE[0],
  );
  const [ply, setPly] = useState<number>(SHOGI_REPERTOIRE[0].movesUsi.length);
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(completedIds));
    } catch {
      // ignore storage quota errors
    }
  }, [completedIds]);

  const phaseLines = useMemo(
    () =>
      SHOGI_REPERTOIRE.filter((l) => l.phase === activePhase).sort(
        (a, b) => a.level - b.level,
      ),
    [activePhase],
  );

  const activePhaseMeta =
    REPERTOIRE_PHASES.find((p) => p.id === activePhase) ?? REPERTOIRE_PHASES[0];

  const { positions, moves } = useMemo(() => {
    const posArr: ShogiPosition[] = [parseSfen(selectedLine.initialSfen)];
    const moveArr: ShogiMove[] = [];
    for (const usi of selectedLine.movesUsi) {
      const cur = posArr[posArr.length - 1];
      const m = findLegalMoveByUsi(cur, usi);
      if (!m) break;
      moveArr.push(m);
      posArr.push(applyMove(cur, m));
    }
    return { positions: posArr, moves: moveArr };
  }, [selectedLine]);

  const activePly = Math.min(ply, positions.length - 1);
  const currentPos = positions[activePly];
  const lastMove = activePly > 0 ? moves[activePly - 1] : undefined;

  const selectPhase = (phase: RepertoirePhase) => {
    setActivePhase(phase);
    const firstInPhase = SHOGI_REPERTOIRE.find(
      (l) => l.phase === phase && l.level === 1,
    );
    if (firstInPhase) {
      setSelectedLine(firstInPhase);
      setPly(firstInPhase.movesUsi.length);
    }
  };

  const selectLine = (line: JosekiLine) => {
    setSelectedLine(line);
    setPly(line.movesUsi.length);
  };

  const toggleCompleted = (id: string) => {
    setCompletedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const renderHandStrip = (side: Side) => {
    const hasAny = HAND_ORDER.some((p) => currentPos.hands[side][p] > 0);
    if (!hasAny) return null;
    return (
      <div className="rep-hand-pill">
        <span className="komadai-label">
          {side === 'b' ? '▲ Sente Hand:' : '△ Gote Hand:'}
        </span>
        <div className="puzzle-hand-pieces">
          {HAND_ORDER.map((pType) => {
            const count = currentPos.hands[side][pType];
            if (count === 0) return null;
            return (
              <div key={pType} className="rep-hand-item">
                <div className="komadai-piece-icon">
                  <ShogiPieceSvg
                    type={pType}
                    side={side}
                    showEnglishHint={showEnglishHints}
                    size="hand"
                  />
                </div>
                {count > 1 && <span className="komadai-count">{count}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isCompleted = completedIds.includes(selectedLine.id);

  return (
    <div className="repertoire-layout">
      {/* Left Sidebar: 3 Phase Tabs (Joban / Chuban / Shuban) + Levels 1-5 */}
      <aside className="repertoire-sidebar">
        <div className="panel-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BookOpen size={15} className="accent-icon" />
            <span>{t('rep.header')}</span>
          </div>
          <span className="mono-pill">
            {completedIds.length}/{SHOGI_REPERTOIRE.length}
          </span>
        </div>

        {/* 3 Main Phases Switcher */}
        <div className="rep-phase-tabs">
          {REPERTOIRE_PHASES.map((phase) => {
            const doneInPhase = SHOGI_REPERTOIRE.filter(
              (l) => l.phase === phase.id && completedIds.includes(l.id),
            ).length;
            return (
              <button
                key={phase.id}
                type="button"
                className={`rep-phase-btn ${activePhase === phase.id ? 'active' : ''}`}
                onClick={() => selectPhase(phase.id)}
              >
                <span className="rep-phase-name">
                  {phase.id === 'joban'
                    ? 'Joban'
                    : phase.id === 'chuban'
                      ? 'Chūban'
                      : 'Shūban'}
                </span>
                <span className="rep-phase-sub">
                  {phase.japanese} • {doneInPhase}/5
                </span>
              </button>
            );
          })}
        </div>

        <div className="rep-phase-banner">
          <div className="rep-phase-banner-title">{activePhaseMeta.label}</div>
          <div className="rep-phase-banner-desc">{activePhaseMeta.subtitle}</div>
        </div>

        {/* Level 1-5 Curriculum Cards */}
        <div className="repertoire-list">
          {phaseLines.map((line) => {
            const done = completedIds.includes(line.id);
            return (
              <button
                key={line.id}
                type="button"
                className={`repertoire-item ${selectedLine.id === line.id ? 'active' : ''}`}
                onClick={() => selectLine(line)}
              >
                <div className="rep-item-top">
                  <span className="rep-code">Level {line.level}</span>
                  <span className="rep-cat">
                    {done ? (
                      <span className="win-text">✓ {t('rep.done')}</span>
                    ) : (
                      line.ecoCode
                    )}
                  </span>
                </div>
                <div className="rep-name">{line.levelTitle.replace(/^Level \d:\s*/, '')}</div>
                <div className="rep-jp">{line.name}</div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Center: 9x9 Interactive Board + Mochigoma Hands */}
      <div className="repertoire-center">
        <div className="puzzle-board-stack">
          {renderHandStrip('w')}
          <div className={`shogi-board-frame theme-${boardTheme}`}>
            <div className="board-coords-top">
              {FILES.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
            <div className="board-and-ranks">
              <div className={`shogi-grid theme-${boardTheme}`}>
                {currentPos.board.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const isDark = (rIdx + cIdx) % 2 === 1;
                    const isLast =
                      lastMove &&
                      ((lastMove.from?.row === rIdx && lastMove.from?.col === cIdx) ||
                        (lastMove.to.row === rIdx && lastMove.to.col === cIdx));
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className={`shogi-cell ${isDark ? 'dark-sq' : 'light-sq'} ${
                          isLast ? 'last-move' : ''
                        }`}
                      >
                        {cell && (
                          <ShogiPieceSvg
                            type={cell.type}
                            side={cell.side}
                            showEnglishHint={showEnglishHints}
                          />
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
              <div className="board-coords-right">
                {RANKS_JP.map((rk) => (
                  <span key={rk}>{rk}</span>
                ))}
              </div>
            </div>
          </div>
          {renderHandStrip('b')}
        </div>
      </div>

      {/* Right Inspector: Level Details, Playback Controls, Move Chips, Concepts */}
      <aside className="repertoire-inspector">
        <div className="panel-section-header">
          <div>
            <div className="rep-inspector-level">{selectedLine.levelTitle}</div>
            <div className="rep-inspector-title">{selectedLine.name}</div>
          </div>
          <span className="mono-pill">{selectedLine.ecoCode}</span>
        </div>

        <p className="rep-summary">{selectedLine.summary}</p>

        <div className="rep-controls">
          <button
            type="button"
            className="nav-ctrl-btn"
            onClick={() => setPly(0)}
            disabled={activePly === 0}
            title="Posisi Awal"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            className="nav-ctrl-btn"
            onClick={() => setPly(Math.max(0, activePly - 1))}
            disabled={activePly === 0}
            title="Langkah Sebelumnya"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="ply-indicator mono">
            Ply {activePly} / {moves.length}
          </span>
          <button
            type="button"
            className="nav-ctrl-btn"
            onClick={() => setPly(Math.min(moves.length, activePly + 1))}
            disabled={activePly >= moves.length}
            title="Langkah Berikutnya"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="rep-moves-chips">
          {moves.map((m, idx) => (
            <button
              key={`${m.usi}-${idx}`}
              type="button"
              className={`move-chip ${activePly === idx + 1 ? 'active' : ''}`}
              onClick={() => setPly(idx + 1)}
            >
              <span className="chip-num">{idx + 1}.</span>
              <span>{notationMode === 'kifu' ? m.kifu : m.western}</span>
            </button>
          ))}
        </div>

        <div className="rep-ideas">
          <h4>Poin Strategi Utama</h4>
          <ul>
            {selectedLine.keyIdeas.map((idea, idx) => (
              <li key={idx}>{idea}</li>
            ))}
          </ul>
        </div>

        <div className="puzzle-btn-col">
          <button
            type="button"
            className={`action-pill-btn ${isCompleted ? 'active' : ''}`}
            onClick={() => toggleCompleted(selectedLine.id)}
          >
            <CheckCircle2 size={14} />
            <span>{isCompleted ? t('rep.markedDone') : t('rep.markDone')}</span>
          </button>
          <button
            type="button"
            className="primary-solid-btn full-width"
            onClick={() =>
              onSendToAnalysis(
                selectedLine.name,
                selectedLine.movesUsi,
                selectedLine.initialSfen,
              )
            }
          >
            {t('rep.openAnalysis')}
          </button>
        </div>
      </aside>
    </div>
  );
};
