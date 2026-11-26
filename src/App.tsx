import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from './components/AuthModal';
import { GameDatabaseSidebar } from './components/GameDatabaseSidebar';
import { HomeLauncher } from './components/HomeLauncher';
import {
  ImportModal,
  PlayConfig,
  PlaySetupModal,
  SettingsHelpModal,
} from './components/Modals';
import { PuzzlesView } from './components/PuzzlesView';
import { RepertoireView } from './components/RepertoireView';
import {
  PlayerProfile,
  ShellChrome,
  WorkspaceTab,
  WorkspaceTabKind,
} from './components/ShellChrome';
import { ArenaTabState, ShogiBoardArena } from './components/ShogiBoardArena';
import { createSampleDatabaseGames } from './data/databaseSamples';
import { INITIAL_RECENT_GAMES, RecentGameRecord } from './data/sampleGames';
import {
  loadGamesFromDeviceDb,
  saveGamesToDeviceDb,
} from './engine/dbStorage';
import { disableGoogleAutoSelect } from './engine/googleAuth';
import { ParsedDatabaseGame } from './engine/kifuParser';
import { INITIAL_SFEN } from './engine/types';
import { fetchUsiStatus } from './engine/usiClient';

const PROFILE_STORAGE_KEY = 'shogi_studio_profile_v2';
const RECENT_STORAGE_KEY = 'shogi_studio_recent_v1';
const DATABASE_STORAGE_KEY = 'shogi_studio_database_v1';

const DEFAULT_PROFILE: PlayerProfile = {
  username: 'Sente_Studio',
  elo: 1580,
  targetElo: 1800,
  preferredSide: 'b',
  defaultTimeControl: '10+0',
  loggedIn: false,
};

export function App() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: 'tab-home-1', title: 'New Tab', kind: 'home' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-home-1');
  const [arenaStates, setArenaStates] = useState<Record<string, ArenaTabState>>({});

  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [recentGames, setRecentGames] = useState<RecentGameRecord[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL_RECENT_GAMES;
    } catch {
      return INITIAL_RECENT_GAMES;
    }
  });

  const [databaseGames, setDatabaseGames] = useState<ParsedDatabaseGame[]>(() =>
    createSampleDatabaseGames(),
  );
  const [dbHydrated, setDbHydrated] = useState<boolean>(false);

  const [databaseOpen, setDatabaseOpen] = useState<boolean>(false);
  const [usiReady, setUsiReady] = useState<boolean>(false);
  const [boardTheme, setBoardTheme] = useState<'kaya' | 'walnut'>('kaya');
  const [showEnglishHints, setShowEnglishHints] = useState<boolean>(false);
  const [notationMode, setNotationMode] = useState<'kifu' | 'western'>('kifu');

  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [guestDismissed, setGuestDismissed] = useState(false);
  const [settingsHelpMode, setSettingsHelpMode] = useState<'settings' | 'help' | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentGames));
    } catch {
      // ignore storage quota errors
    }
  }, [recentGames]);

  // Load database games from browser IndexedDB on mount (with localStorage migration fallback)
  useEffect(() => {
    let active = true;
    void loadGamesFromDeviceDb().then((stored) => {
      if (!active) return;
      if (stored && stored.length > 0) {
        setDatabaseGames(stored);
      } else {
        try {
          const legacyRaw = localStorage.getItem(DATABASE_STORAGE_KEY);
          if (legacyRaw) {
            const parsed = JSON.parse(legacyRaw) as ParsedDatabaseGame[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDatabaseGames(parsed);
            }
          }
        } catch {
          // ignore
        }
      }
      setDbHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist all database games to device IndexedDB
  useEffect(() => {
    if (!dbHydrated) return;
    void saveGamesToDeviceDb(databaseGames);
  }, [databaseGames, dbHydrated]);

  const createTab = useCallback(
    (kind: WorkspaceTabKind, title: string, arenaConfig?: Omit<ArenaTabState, 'tabId'>) => {
      const id = `tab-${kind}-${Date.now()}`;
      setTabs((prev) => [...prev, { id, title, kind }]);
      if (arenaConfig) {
        setArenaStates((prev) => ({
          ...prev,
          [id]: { ...arenaConfig, tabId: id },
        }));
      }
      setActiveTabId(id);
      return id;
    },
    [],
  );

  const handleNewHomeTab = useCallback(() => {
    createTab('home', 'New Tab');
  }, [createTab]);

  const handleCloseTab = (id: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        setActiveTabId(fallback.id);
      }
      return next;
    });
    setArenaStates((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleQuickAction = (kind: WorkspaceTabKind) => {
    setDatabaseOpen(false);
    if (kind === 'home') {
      const existingHome = tabs.find((t) => t.kind === 'home');
      if (existingHome) setActiveTabId(existingHome.id);
      else createTab('home', 'New Tab');
      return;
    }
    if (kind === 'play') {
      setShowPlayModal(true);
      return;
    }
    if (kind === 'analysis') {
      createTab('analysis', 'Analysis Board', {
        mode: 'analysis',
        title: 'Analysis Board',
        initialSfen: INITIAL_SFEN,
      });
      return;
    }
    if (kind === 'repertoire') {
      const existingRep = tabs.find((t) => t.kind === 'repertoire');
      if (existingRep) setActiveTabId(existingRep.id);
      else createTab('repertoire', 'Joseki Repertoire');
      return;
    }
    if (kind === 'puzzles') {
      const existingPuz = tabs.find((t) => t.kind === 'puzzles');
      if (existingPuz) setActiveTabId(existingPuz.id);
      else createTab('puzzles', 'Tsume Puzzles');
    }
  };

  const handleStartMatch = (config: PlayConfig) => {
    setShowPlayModal(false);
    const title =
      config.mode === 'bot'
        ? `vs ${config.botName} (${config.botElo})`
        : 'Local 2P Match';
    createTab('play', title, {
      mode: 'play',
      title,
      playConfig: config,
      initialSfen: INITIAL_SFEN,
    });
  };

  const handleOpenDatabaseGame = useCallback(
    (game: ParsedDatabaseGame) => {
      createTab('analysis', game.title, {
        mode: 'analysis',
        title: game.title,
        initialSfen: game.initialSfen || INITIAL_SFEN,
        preloadMovesUsi: game.movesUsi,
      });
    },
    [createTab],
  );

  const handleImportToDatabase = useCallback(
    (imported: ParsedDatabaseGame[], openFirstInAnalysis: boolean) => {
      setShowImportModal(false);
      setDatabaseGames((prev) => [...imported, ...prev]);
      setDatabaseOpen(true);
      if (openFirstInAnalysis && imported[0]) {
        handleOpenDatabaseGame(imported[0]);
      }
    },
    [handleOpenDatabaseGame],
  );

  const handleOpenRecentGame = (game: RecentGameRecord) => {
    createTab('analysis', game.title, {
      mode: 'analysis',
      title: game.title,
      initialSfen: game.initialSfen ?? INITIAL_SFEN,
      preloadMovesUsi: game.movesUsi,
    });
  };

  const handleGameFinished = useCallback(
    (record: {
      title: string;
      senteName: string;
      senteElo: number;
      goteName: string;
      goteElo: number;
      result: '1-0' | '0-1' | '½-½';
      timeControl: string;
      movesUsi: string[];
      initialSfen: string;
    }) => {
      setRecentGames((prev) => [
        {
          id: `game-${Date.now()}`,
          dateLabel: 'Just now',
          ...record,
        },
        ...prev.slice(0, 14),
      ]);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const check = async () => {
      const st = await fetchUsiStatus();
      if (active) setUsiReady(Boolean(st?.ready));
    };
    void check();
    const timer = window.setInterval(check, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Ctrl+T opens New Tab cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewHomeTab();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewHomeTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Initial view: dedicated Login screen when not signed in
  if (!profile.loggedIn && !guestDismissed) {
    return (
      <AuthModal
        profile={profile}
        isEntryGate
        onClose={() => {}}
        onSave={(next) => {
          setProfile(next);
          setGuestDismissed(false);
          setShowAuthModal(false);
        }}
        onLogout={() => {
          disableGoogleAutoSelect();
          setProfile((prev) => ({
            ...prev,
            loggedIn: false,
            avatarUrl: undefined,
            authProvider: undefined,
          }));
          setGuestDismissed(false);
        }}
        onContinueAsGuest={() => {
          setGuestDismissed(true);
        }}
      />
    );
  }

  return (
    <>
      <ShellChrome
        tabs={tabs}
        activeTabId={activeTab.id}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewHomeTab}
        onOpenQuickAction={handleQuickAction}
        onOpenImport={() => setShowImportModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenSettings={() => setSettingsHelpMode('settings')}
        onOpenHelp={() => setSettingsHelpMode('help')}
        databaseOpen={databaseOpen}
        onToggleDatabase={() => setDatabaseOpen((o) => !o)}
        sidebarSlot={
          <GameDatabaseSidebar
            games={databaseGames}
            onClose={() => setDatabaseOpen(false)}
            onAddGames={(imported) =>
              setDatabaseGames((prev) => [...imported, ...prev])
            }
            onOpenGame={handleOpenDatabaseGame}
            onRemoveGame={(id) =>
              setDatabaseGames((prev) => prev.filter((g) => g.id !== id))
            }
            onClearAll={() => setDatabaseGames([])}
            onOpenPasteImport={() => setShowImportModal(true)}
          />
        }
        boardTheme={boardTheme}
        onToggleBoardTheme={() =>
          setBoardTheme((t) => (t === 'kaya' ? 'walnut' : 'kaya'))
        }
        showEnglishHints={showEnglishHints}
        onToggleEnglishHints={() => setShowEnglishHints((v) => !v)}
        notationMode={notationMode}
        onToggleNotationMode={() =>
          setNotationMode((m) => (m === 'kifu' ? 'western' : 'kifu'))
        }
        usiReady={usiReady}
        profile={profile}
      >
        {tabs.map((tab) => {
          const isVisible = tab.id === activeTab.id;
          return (
            <div
              key={tab.id}
              className="tab-pane"
              style={{ display: isVisible ? 'flex' : 'none' }}
            >
              {tab.kind === 'home' && (
                <HomeLauncher
                  onPlayGame={() => setShowPlayModal(true)}
                  onOpenAnalysis={() => handleQuickAction('analysis')}
                  onOpenRepertoire={() => handleQuickAction('repertoire')}
                  onImportGame={() => setShowImportModal(true)}
                  onOpenPuzzles={() => handleQuickAction('puzzles')}
                  recentGames={recentGames}
                  onOpenRecentGame={handleOpenRecentGame}
                  onClearRecentGames={() => setRecentGames([])}
                />
              )}
              {(tab.kind === 'play' || tab.kind === 'analysis') &&
                arenaStates[tab.id] && (
                  <ShogiBoardArena
                    tabState={arenaStates[tab.id]}
                    profile={profile}
                    usiReady={usiReady}
                    boardTheme={boardTheme}
                    showEnglishHints={showEnglishHints}
                    notationMode={notationMode}
                    onGameFinished={handleGameFinished}
                  />
                )}
              {tab.kind === 'repertoire' && (
                <RepertoireView
                  boardTheme={boardTheme}
                  showEnglishHints={showEnglishHints}
                  notationMode={notationMode}
                  onSendToAnalysis={(title, movesUsi, customSfen) =>
                    createTab('analysis', `Analysis: ${title}`, {
                      mode: 'analysis',
                      title: `Analysis: ${title}`,
                      initialSfen: customSfen ?? INITIAL_SFEN,
                      preloadMovesUsi: movesUsi,
                    })
                  }
                />
              )}
              {tab.kind === 'puzzles' && (
                <PuzzlesView
                  boardTheme={boardTheme}
                  showEnglishHints={showEnglishHints}
                />
              )}
            </div>
          );
        })}
      </ShellChrome>

      {showPlayModal && (
        <PlaySetupModal
          defaultSide={profile.preferredSide}
          usiReady={usiReady}
          onClose={() => setShowPlayModal(false)}
          onStart={handleStartMatch}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImportToDatabase={handleImportToDatabase}
        />
      )}

      {(showAuthModal || (!profile.loggedIn && !guestDismissed)) && (
        <AuthModal
          profile={profile}
          isEntryGate={!profile.loggedIn && !guestDismissed && !showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSave={(next) => {
            setProfile(next);
            setGuestDismissed(false);
            setShowAuthModal(false);
          }}
          onLogout={() => {
            disableGoogleAutoSelect();
            setProfile((prev) => ({
              ...prev,
              loggedIn: false,
              avatarUrl: undefined,
              authProvider: undefined,
            }));
            setGuestDismissed(false);
            setShowAuthModal(false);
          }}
          onContinueAsGuest={() => {
            setGuestDismissed(true);
            setShowAuthModal(false);
          }}
        />
      )}

      {settingsHelpMode && (
        <SettingsHelpModal
          mode={settingsHelpMode}
          boardTheme={boardTheme}
          onToggleBoardTheme={() =>
            setBoardTheme((t) => (t === 'kaya' ? 'walnut' : 'kaya'))
          }
          showEnglishHints={showEnglishHints}
          onToggleEnglishHints={() => setShowEnglishHints((v) => !v)}
          notationMode={notationMode}
          onToggleNotationMode={() =>
            setNotationMode((m) => (m === 'kifu' ? 'western' : 'kifu'))
          }
          onClose={() => setSettingsHelpMode(null)}
        />
      )}
    </>
  );
}

export default App;
