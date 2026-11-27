import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Cpu,
  Database,
  Home,
  Minus,
  Plus,
  Puzzle,
  Settings,
  Square,
  User,
  X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { ShogiKomaIcon } from './ShogiKomaIcon';

export type WorkspaceTabKind =
  | 'home'
  | 'play'
  | 'analysis'
  | 'repertoire'
  | 'puzzles';

export interface WorkspaceTab {
  id: string;
  title: string;
  kind: WorkspaceTabKind;
}

export interface PlayerProfile {
  username: string;
  email?: string;
  avatarUrl?: string;
  authProvider?: 'google' | 'email' | 'guest';
  elo: number;
  targetElo: number;
  preferredSide: 'b' | 'w' | 'random';
  defaultTimeControl: string;
  loggedIn: boolean;
}

interface ShellChromeProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onOpenQuickAction: (kind: WorkspaceTabKind) => void;
  onOpenImport: () => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  databaseOpen: boolean;
  onToggleDatabase: () => void;
  sidebarSlot?: React.ReactNode;
  boardTheme: 'kaya' | 'walnut';
  onToggleBoardTheme: () => void;
  showEnglishHints: boolean;
  onToggleEnglishHints: () => void;
  notationMode: 'kifu' | 'western';
  onToggleNotationMode: () => void;
  usiReady: boolean;
  profile: PlayerProfile;
  children: React.ReactNode;
}

export const ShellChrome: React.FC<ShellChromeProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onOpenQuickAction,
  onOpenImport,
  onOpenAuth,
  onOpenSettings,
  onOpenHelp,
  databaseOpen,
  onToggleDatabase,
  sidebarSlot,
  boardTheme,
  onToggleBoardTheme,
  showEnglishHints,
  onToggleEnglishHints,
  notationMode,
  onToggleNotationMode,
  usiReady,
  profile,
  children,
}) => {
  const { t } = useI18n();
  const [openMenu, setOpenMenu] = useState<'file' | 'view' | 'help' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="studio-shell">
      {/* 34px Native Desktop Title & Menu Bar */}
      <header className="shell-titlebar" ref={menuRef}>
        <div className="shell-titlebar-left">
          <img
            src="/shogi-logo.png?v=3"
            alt="Shogi Studio Logo"
            className="shell-logo-img"
            title="Shogi Studio"
          />
          <span className="shell-app-name">Shogi Studio</span>

          <nav className="shell-menubar">
            <div className="menu-group">
              <button
                type="button"
                className={`menu-trigger ${openMenu === 'file' ? 'active' : ''}`}
                onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
              >
                {t('menu.file')}
              </button>
              {openMenu === 'file' && (
                <div className="menu-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      onNewTab();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.newTab')}</span>
                    <kbd>Ctrl+T</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenQuickAction('play');
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.newMatch')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenQuickAction('analysis');
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.newAnalysis')}</span>
                  </button>
                  <div className="menu-sep" />
                  <button
                    type="button"
                    onClick={() => {
                      onOpenImport();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.import')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleDatabase();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{databaseOpen ? t('menu.hideDb') : t('menu.openDb')}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="menu-group">
              <button
                type="button"
                className={`menu-trigger ${openMenu === 'view' ? 'active' : ''}`}
                onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
              >
                {t('menu.view')}
              </button>
              {openMenu === 'view' && (
                <div className="menu-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleBoardTheme();
                      setOpenMenu(null);
                    }}
                  >
                    <span>
                      {t('menu.boardStyle')}: {boardTheme === 'kaya' ? 'Kaya Wood' : 'Classic Walnut'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleEnglishHints();
                      setOpenMenu(null);
                    }}
                  >
                    <span>
                      {t('menu.pieceHints')}: {showEnglishHints ? t('settings.enabled') : t('settings.disabled')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onToggleNotationMode();
                      setOpenMenu(null);
                    }}
                  >
                    <span>
                      {t('menu.notation')}: {notationMode === 'kifu' ? 'Japanese Kifu (▲7六歩)' : 'Western (P-7f)'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="menu-group">
              <button
                type="button"
                className={`menu-trigger ${openMenu === 'help' ? 'active' : ''}`}
                onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
              >
                {t('menu.help')}
              </button>
              {openMenu === 'help' && (
                <div className="menu-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenHelp();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.rulesGuide')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setOpenMenu(null);
                    }}
                  >
                    <span>{t('menu.preferences')}</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="shell-titlebar-right">
          <div
            className={`engine-status-pill ${usiReady ? 'online' : ''}`}
            title={
              usiReady
                ? 'YaneuraOu + Suisho5 Engine Online (Vercel Rust/WASM / Local AVX2)'
                : 'Built-in Rust/WASM Browser Engine Active'
            }
          >
            <span className={`status-dot ${usiReady ? 'online' : ''}`} />
            <span>{usiReady ? 'YaneuraOu + Suisho5' : t('engine.browser')}</span>
          </div>

          <button
            type="button"
            className="shell-profile-pill"
            onClick={onOpenAuth}
            title={
              profile.loggedIn
                ? `${profile.username} (${profile.email ?? 'Signed in'})`
                : t('auth.modalTitle')
            }
          >
            {profile.loggedIn && profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.username}
                className="profile-avatar-img"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className={`status-dot ${profile.loggedIn ? 'online' : ''}`} />
            )}
            <span className="profile-name">
              {profile.loggedIn ? profile.username : t('auth.loginPill')}
            </span>
            <span className="profile-elo">{profile.elo}</span>
          </button>

          <div className="window-controls" aria-hidden="true">
            <span className="win-btn">
              <Minus size={12} />
            </span>
            <span className="win-btn">
              <Square size={10} />
            </span>
            <span className="win-btn close">
              <X size={12} />
            </span>
          </div>
        </div>
      </header>

      {/* 36px Browser-Style Tab Strip */}
      <div className="shell-tabstrip">
        <div className="tab-corner-spacer" />
        <div className="tabs-scroll">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`studio-tab ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
                role="tab"
                aria-selected={isActive}
              >
                <span className="tab-title">{tab.title}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    className="tab-close"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="tab-add-btn"
            onClick={onNewTab}
            title="New Tab"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main Workspace: 52px Left Icon Rail + Active Canvas */}
      <div className="shell-body">
        <aside className="shell-icon-rail" aria-label="Workspace Navigation">
          <div className="rail-top">
            <button
              type="button"
              className={`rail-btn ${!databaseOpen && activeTab?.kind === 'home' ? 'active' : ''}`}
              onClick={() => onOpenQuickAction('home')}
              title={t('rail.home')}
            >
              <Home size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`rail-btn ${!databaseOpen && activeTab?.kind === 'play' ? 'active' : ''}`}
              onClick={() => onOpenQuickAction('play')}
              title={t('rail.play')}
            >
              <ShogiKomaIcon size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`rail-btn ${!databaseOpen && activeTab?.kind === 'analysis' ? 'active' : ''}`}
              onClick={() => onOpenQuickAction('analysis')}
              title={t('rail.analysis')}
            >
              <Cpu size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`rail-btn ${!databaseOpen && activeTab?.kind === 'repertoire' ? 'active' : ''}`}
              onClick={() => onOpenQuickAction('repertoire')}
              title={t('rail.repertoire')}
            >
              <BookOpen size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`rail-btn ${!databaseOpen && activeTab?.kind === 'puzzles' ? 'active' : ''}`}
              onClick={() => onOpenQuickAction('puzzles')}
              title={t('rail.puzzles')}
            >
              <Puzzle size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className={`rail-btn ${databaseOpen ? 'active' : ''}`}
              onClick={onToggleDatabase}
              title={t('rail.database')}
            >
              <Database size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="rail-btn"
              onClick={onOpenAuth}
              title={t('rail.account')}
            >
              <User size={20} strokeWidth={1.75} />
            </button>
          </div>

          <div className="rail-bottom">
            <button
              type="button"
              className="rail-btn"
              onClick={onOpenSettings}
              title={t('rail.settings')}
            >
              <Settings size={20} strokeWidth={1.75} />
            </button>
          </div>
        </aside>

        {databaseOpen && sidebarSlot}

        <main className="shell-canvas">{children}</main>
      </div>
    </div>
  );
};
