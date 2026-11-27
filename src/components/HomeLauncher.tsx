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
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const cards = [
    {
      id: 'play',
      title: t('home.playTitle'),
      description: t('home.playDesc'),
      cta: t('home.playCta'),
      icon: <ShogiKomaIcon size={50} strokeWidth={1.35} />,
      onClick: onPlayGame,
    },
    {
      id: 'analysis',
      title: t('home.analysisTitle'),
      description: t('home.analysisDesc'),
      cta: t('home.analysisCta'),
      icon: <Cpu size={50} strokeWidth={1.35} />,
      onClick: onOpenAnalysis,
    },
    {
      id: 'repertoire',
      title: t('home.repertoireTitle'),
      description: t('home.repertoireDesc'),
      cta: t('home.repertoireCta'),
      icon: <BookOpen size={50} strokeWidth={1.35} />,
      onClick: onOpenRepertoire,
    },
    {
      id: 'import',
      title: t('home.importTitle'),
      description: t('home.importDesc'),
      cta: t('home.importCta'),
      icon: <FolderOpen size={50} strokeWidth={1.35} />,
      onClick: onImportGame,
    },
    {
      id: 'puzzles',
      title: t('home.puzzlesTitle'),
      description: t('home.puzzlesDesc'),
      cta: t('home.puzzlesCta'),
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
              <p className="home-subtitle">{t('home.subtitle')}</p>
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
        <section className="recent-files-panel" aria-label={t('home.recentFiles')}>
          <div className="recent-header">
            <div className="recent-title-wrap">
              <Clock size={15} className="muted-icon" />
              <h3 className="recent-title">{t('home.recentFiles')}</h3>
              <span className="recent-count">{recentGames.length}</span>
            </div>
            <div className="recent-actions">
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={onImportGame}
              >
                <FilePlus2 size={13} />
                <span>{t('home.importKifu')}</span>
              </button>
              {recentGames.length > 0 && (
                <button
                  type="button"
                  className="ghost-btn-sm"
                  onClick={onClearRecentGames}
                >
                  <Trash2 size={13} />
                  <span>{t('home.clear')}</span>
                </button>
              )}
            </div>
          </div>

          {recentGames.length === 0 ? (
            <div className="recent-empty">{t('home.recentEmpty')}</div>
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
