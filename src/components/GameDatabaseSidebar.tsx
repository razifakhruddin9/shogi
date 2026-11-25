import React, { useMemo, useRef, useState } from 'react';
import {
  Database,
  Download,
  FileUp,
  Globe,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { downloadDatabaseToDevice } from '../engine/dbStorage';
import {
  DatabaseFormat,
  decodeShogiTextBuffer,
  ParsedDatabaseGame,
  parseDatabaseImport,
} from '../engine/kifuParser';

interface GameDatabaseSidebarProps {
  games: ParsedDatabaseGame[];
  onClose: () => void;
  onAddGames: (imported: ParsedDatabaseGame[]) => void;
  onOpenGame: (game: ParsedDatabaseGame) => void;
  onRemoveGame: (id: string) => void;
  onClearAll: () => void;
  onLoadSamples: () => void;
  onOpenPasteImport: () => void;
}

const FORMAT_FILTERS: { id: 'all' | DatabaseFormat; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kif', label: 'KIF' },
  { id: 'ki2', label: 'KI2' },
  { id: 'csa', label: 'CSA' },
  { id: 'sfen', label: 'SFEN' },
];

export const GameDatabaseSidebar: React.FC<GameDatabaseSidebarProps> = ({
  games,
  onClose,
  onAddGames,
  onOpenGame,
  onRemoveGame,
  onClearAll,
  onLoadSamples,
  onOpenPasteImport,
}) => {
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | DatabaseFormat>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const allParsed: ParsedDatabaseGame[] = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const text = decodeShogiTextBuffer(buf);
      const parsed = parseDatabaseImport(text, file.name);
      allParsed.push(...parsed);
    }

    if (allParsed.length > 0) {
      onAddGames(allParsed);
      setImportFeedback(
        `Imported ${allParsed.length} game${allParsed.length > 1 ? 's' : ''} from ${files.length} file${files.length > 1 ? 's' : ''}.`,
      );
    } else {
      setImportFeedback('No valid Shogi games found in the selected file(s).');
    }

    window.setTimeout(() => setImportFeedback(null), 4000);
  };

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return games.filter((g) => {
      if (formatFilter !== 'all' && g.format !== formatFilter) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.senteName.toLowerCase().includes(q) ||
        g.goteName.toLowerCase().includes(q) ||
        (g.event?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [games, search, formatFilter]);

  return (
    <aside
      className={`db-sidebar ${isDragging ? 'is-dragging' : ''}`}
      aria-label="Game Database Sidebar"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          void processFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Header */}
      <div className="db-sidebar-header">
        <div className="db-header-title">
          <Database size={15} className="accent-icon" />
          <span>Game Database</span>
          <span className="recent-count">{games.length}</span>
        </div>
        <button
          type="button"
          className="icon-close-btn"
          onClick={onClose}
          title="Close Database Sidebar"
        >
          <X size={15} />
        </button>
      </div>

      {/* Drop / Import Controls */}
      <div className="db-import-zone">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".kif,.ki2,.csa,.sfen,.usi,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) {
              void processFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <button
          type="button"
          className="db-upload-btn"
          onClick={onOpenPasteImport}
        >
          <Globe size={15} />
          <span>Import Database (wdoor / Lokal)</span>
        </button>

        <div className="db-sub-actions">
          <button
            type="button"
            className="ghost-btn-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Upload .kif, .ki2, .csa, or .sfen files from PC"
          >
            <FileUp size={12} />
            <span>File Lokal</span>
          </button>
          <button
            type="button"
            className="ghost-btn-sm"
            onClick={onLoadSamples}
            title="Restore built-in sample database games"
          >
            <Sparkles size={12} />
            <span>Samples</span>
          </button>
          {games.length > 0 && (
            <>
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={() => downloadDatabaseToDevice(games)}
                title="Simpan seluruh database ke folder Downloads (.csa)"
              >
                <Download size={12} />
                <span>Simpan .csa</span>
              </button>
              <button
                type="button"
                className="ghost-btn-sm"
                onClick={onClearAll}
                title="Clear all database entries"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>

        <div className="db-drop-hint">
          Tersimpan di perangkat (IndexedDB &amp; Downloads/ShogiStudio)
        </div>
        {importFeedback && <div className="db-feedback">{importFeedback}</div>}
      </div>

      {/* Search & Format Filter */}
      <div className="db-filter-bar">
        <div className="db-search-wrap">
          <Search size={13} className="db-search-icon" />
          <input
            type="text"
            className="db-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player, event, title..."
          />
          {search && (
            <button
              type="button"
              className="db-search-clear"
              onClick={() => setSearch('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="db-format-chips">
          {FORMAT_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`db-chip ${formatFilter === f.id ? 'active' : ''}`}
              onClick={() => setFormatFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Game List */}
      <div className="db-list-scroll">
        {filteredGames.length === 0 ? (
          <div className="db-empty-state">
            {games.length === 0
              ? 'Database is empty. Import .kif, .ki2, .csa, or .sfen files above.'
              : 'No games match your search/format filter.'}
          </div>
        ) : (
          filteredGames.map((g) => (
            <div
              key={g.id}
              className="db-game-card"
              onClick={() => onOpenGame(g)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenGame(g);
                }
              }}
            >
              <div className="db-card-top">
                <span className={`fmt-badge fmt-${g.format}`}>
                  {g.format.toUpperCase()}
                </span>
                <span className="db-card-date">{g.dateLabel}</span>
                <button
                  type="button"
                  className="db-card-del"
                  title="Remove from database"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveGame(g.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="db-card-title">{g.title}</div>
              <div className="db-card-players">
                ▲ {g.senteName} vs △ {g.goteName}
              </div>

              <div className="db-card-bottom">
                <span className="mono-pill">{g.movesUsi.length} ply</span>
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
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
