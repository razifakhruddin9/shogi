import React from 'react';
import {
  BookOpen,
  Clock,
  Cpu,
  FilePlus2,
  FolderOpen,
  Puzzle,
  Trash2,
} from 'lucide-react';
import { RecentGameRecord } from '../data/sampleGames';
import { ShogiKomaIcon } from './ShogiKomaIcon';

interface HomeLauncherProps {
  onPlayGame: () => void;
  onOpenAnalysis: () => void;
  onOpenRepertoire: () => void;
  onImportGame: () => void;
  onOpenPuzzles: () => void;
  recentGames: RecentGameRecord[];
  onOpenRecentGame: (game: RecentGameRecord) => void;
  onClearRecentGames: () => void;
}

export const HomeLauncher: React.FC<HomeLauncherProps> = ({
  onPlayGame,
  onOpenAnalysis,
  onOpenRepertoire,
  onImportGame,
  onOpenPuzzles,
  recentGames,
  onOpenRecentGame,
  onClearRecentGames,
}) => {
  const cards = [
    {
      id: 'play',
      title: 'Play Game',
      description: 'Challenge AI Shogi bots across Elo tiers or play local 2-player matches.',
      cta: 'Play',
      icon: <ShogiKomaIcon size={50} strokeWidth={1.35} />,
      onClick: onPlayGame,
    },
    {
      id: 'analysis',
      title: 'Analysis Board',
      description: 'Inspect 9×9 lines with real-time engine eval bar and best-move arrows.',
      cta: 'Open',
      icon: <Cpu size={50} strokeWidth={1.35} />,
      onClick: onOpenAnalysis,
    },
    {
      id: 'repertoire',
      title: 'New Repertoire',
      description: 'Study Static Rook & Ranging Rook joseki lines move by move.',
      cta: 'Create',
      icon: <BookOpen size={50} strokeWidth={1.35} />,
      onClick: onOpenRepertoire,
    },
    {
      id: 'import',
      title: 'Import Game',
      description: 'Load SFEN positions or USI move sequences into a review tab.',
      cta: 'Import',
      icon: <FolderOpen size={50} strokeWidth={1.35} />,
      onClick: onImportGame,
    },
    {
      id: 'puzzles',
      title: 'Puzzles',
      description: 'Sharpen your tactical vision with Tsume-Shogi checkmate trainers.',
      cta: 'Train',
      icon: <Puzzle size={50} strokeWidth={1.35} />,
      onClick: onOpenPuzzles,
    },
  ];

  return (
    <div className="home-launcher-scroll">
      <div className="home-launcher-container">
        <div className="home-header-row">
          <div className="home-brand-block">
            <img
              src="/shogi-logo.png?v=3"
              alt="Shogi Studio Emblem"
              className="home-logo-img"
            />
            <div>
              <h1 className="home-title">Shogi Studio</h1>
              <p className="home-subtitle">
                9×9 Japanese Chess Workspace • Full Drop Rules, Live Engine Eval &amp; Tsume Trainer
              </p>
            </div>
          </div>
          <div className="home-badge-row">
            <span className="studio-tag">SFEN / USI Ready</span>
            <span className="studio-tag">Offline Engine</span>
          </div>
        </div>

        {/* 5-Card Action Launcher Grid */}
        <section className="action-cards-grid" aria-label="Quick Actions">
          {cards.map((card) => (
            <div key={card.id} className="launcher-card">
              <div className="launcher-card-icon">{card.icon}</div>
              <div className="launcher-card-body">
                <h2 className="launcher-card-title">{card.title}</h2>
                <p className="launcher-card-desc">{card.description}</p>
              </div>
              <button
                type="button"
                className="launcher-cta-btn"
                onClick={card.onClick}
              >
                {card.cta}
              </button>
            </div>
          ))}
        </section>

        {/* Recent Files / Match History Panel */}
        <section className="recent-files-panel" aria-label="Recent Files">
          <div className="recent-header">
            <div className="recent-title-wrap">
              <Clock size={15} className="muted-icon" />
              <h3 className="recent-title">Recent Files</h3>
              <span className="recent-count">{recentGames.length}</span>
            </div>
            <div className="recent-actions">
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={onImportGame}
              >
                <FilePlus2 size={13} />
                <span>Import Kifu</span>
              </button>
              {recentGames.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn-sm"
                  onClick={onClearRecentGames}
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {recentGames.length === 0 ? (
            <div className="recent-empty">
              No recent Shogi files. Start a match or import an SFEN/USI game to save it here.
            </div>
          ) : (
            <div className="recent-table">
              {recentGames.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="recent-row"
                  onClick={() => onOpenRecentGame(g)}
                >
                  <div className="recent-row-main">
                    <span className="recent-game-title">{g.title}</span>
                    <span className="recent-players">
                      ▲ {g.senteName} ({g.senteElo}) vs △ {g.goteName} ({g.goteElo})
                    </span>
                  </div>
                  <div className="recent-row-meta">
                    <span className="mono-pill">{g.movesUsi.length} ply</span>
                    <span className="mono-pill">{g.timeControl}</span>
                    <span className="recent-date">{g.dateLabel}</span>
                    <span
                      className={`result-badge ${
                        g.result === '1-0'
                          ? 'win'
                          : g.result === '0-1'
                            ? 'loss'
                            : 'draw'
                      }`}
                    >
                      {g.result}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
