import React, { useEffect, useRef, useState } from 'react';
import { CloudDownload, ExternalLink, FileUp, Globe, X } from 'lucide-react';
import {
  DatabaseFormat,
  decodeShogiTextBuffer,
  ParsedDatabaseGame,
  parseDatabaseImport,
} from '../engine/kifuParser';
import { LocaleCode, SUPPORTED_LOCALES, TranslationKey, useI18n } from '../i18n';
import { PlayerProfile } from './ShellChrome';

export interface PlayConfig {
  mode: 'bot' | 'local';
  engineKind?: 'yaneuraou' | 'browser';
  botElo: number;
  botName: string;
  playerSide: 'b' | 'w' | 'random';
  timeMinutes: number;
  incrementSeconds: number;
}

interface PlaySetupModalProps {
  defaultSide: 'b' | 'w' | 'random';
  usiReady: boolean;
  onProbeLocalEngine?: () => Promise<boolean>;
  onClose: () => void;
  onStart: (config: PlayConfig) => void;
}

const BOTS: {
  name: string;
  elo: number;
  engineKind: 'yaneuraou' | 'browser';
  requiresUsi: boolean;
  descKey: TranslationKey;
}[] = [
  {
    name: 'YaneuraOu + Suisho5',
    elo: 2800,
    engineKind: 'yaneuraou',
    requiresUsi: true,
    descKey: 'bot.yaneuraou.desc',
  },
  {
    name: 'Tanuki Novice',
    elo: 700,
    engineKind: 'browser',
    requiresUsi: false,
    descKey: 'bot.tanuki.desc',
  },
  {
    name: 'Kenshin Club',
    elo: 1200,
    engineKind: 'browser',
    requiresUsi: false,
    descKey: 'bot.kenshin.desc',
  },
  {
    name: 'Habu Master',
    elo: 1600,
    engineKind: 'browser',
    requiresUsi: false,
    descKey: 'bot.habu.desc',
  },
  {
    name: 'Meijin Engine',
    elo: 1950,
    engineKind: 'browser',
    requiresUsi: false,
    descKey: 'bot.meijin.desc',
  },
];

const TIME_CONTROLS = [
  { label: '3 + 0 Blitz', minutes: 3, inc: 0 },
  { label: '5 + 3 Blitz', minutes: 5, inc: 3 },
  { label: '10 + 0 Rapid', minutes: 10, inc: 0 },
  { label: '15 + 10 Classical', minutes: 15, inc: 10 },
  { label: 'Unlimited', minutes: 0, inc: 0 },
];

export const PlaySetupModal: React.FC<PlaySetupModalProps> = ({
  defaultSide,
  usiReady,
  onProbeLocalEngine,
  onClose,
  onStart,
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'bot' | 'local'>('bot');
  const [selectedBotIdx, setSelectedBotIdx] = useState(() => (usiReady ? 0 : 1));
  const [timeIdx, setTimeIdx] = useState(2);
  const [side, setSide] = useState<'b' | 'w' | 'random'>(defaultSide);
  const [probingEngine, setProbingEngine] = useState(false);
  const [probeMsg, setProbeMsg] = useState('');

  const bot = BOTS[Math.min(selectedBotIdx, BOTS.length - 1)];
  const tc = TIME_CONTROLS[timeIdx];
  const isBlockedOfflineBot = mode === 'bot' && bot.requiresUsi && !usiReady;

  const handleProbeEngine = async () => {
    if (!onProbeLocalEngine || probingEngine) return;
    setProbingEngine(true);
    setProbeMsg('');
    try {
      const ok = await onProbeLocalEngine();
      setProbeMsg(
        ok
          ? 'YaneuraOu + Suisho5 terhubung dari bridge lokal!'
          : 'Engine lokal belum terdeteksi di 127.0.0.1:3891. Jalankan `npm run engine` di PC Anda.',
      );
    } finally {
      setProbingEngine(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('play.title')}</h3>
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('play.opponentType')}</label>
            <div className="segmented-control">
              <button
                type="button"
                className={mode === 'bot' ? 'active' : ''}
                onClick={() => setMode('bot')}
              >
                {t('play.vsComputer')}
              </button>
              <button
                type="button"
                className={mode === 'local' ? 'active' : ''}
                onClick={() => setMode('local')}
              >
                {t('play.passPlay')}
              </button>
            </div>
          </div>

          {mode === 'bot' && (
            <div className="form-group">
              <label className="form-label">{t('play.selectEngine')}</label>
              <div className="bot-grid">
                {BOTS.map((b, i) => {
                  const offline = b.requiresUsi && !usiReady;
                  return (
                    <button
                      key={b.name}
                      type="button"
                      className={`bot-option ${b.requiresUsi ? 'is-flagship' : ''} ${
                        offline ? 'is-offline' : ''
                      } ${selectedBotIdx === i ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBotIdx(i);
                        setProbeMsg('');
                      }}
                    >
                      <div className="bot-option-top">
                        <span className="bot-badge-row">
                          <span className="bot-name">{b.name}</span>
                          {b.requiresUsi && (
                            <span className={`bot-status-pill ${usiReady ? 'online' : 'offline'}`}>
                              {usiReady ? t('play.online') : t('play.localPc')}
                            </span>
                          )}
                        </span>
                        <span className="bot-elo">{b.elo}</span>
                      </div>
                      <span className="bot-desc">{t(b.descKey)}</span>
                    </button>
                  );
                })}
              </div>

              {bot.requiresUsi && !usiReady && (
                <div className="usi-offline-notice">
                  <div className="usi-offline-text">{t('play.offlineNotice')}</div>
                  <div className="usi-offline-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => void handleProbeEngine()}
                      disabled={probingEngine}
                    >
                      {probingEngine
                        ? t('play.checkingLocalEngine')
                        : t('play.checkLocalEngine')}
                    </button>
                    {probeMsg && <span className="usi-probe-msg">{probeMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('play.timeControl')}</label>
            <div className="pill-options">
              {TIME_CONTROLS.map((tItem, i) => (
                <button
                  key={tItem.label}
                  type="button"
                  className={`pill-choice ${timeIdx === i ? 'selected' : ''}`}
                  onClick={() => setTimeIdx(i)}
                >
                  {tItem.minutes === 0 ? t('play.unlimited') : tItem.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'bot' && (
            <div className="form-group">
              <label className="form-label">{t('play.playAs')}</label>
              <div className="segmented-control three">
                <button
                  type="button"
                  className={side === 'b' ? 'active' : ''}
                  onClick={() => setSide('b')}
                >
                  {t('arena.senteFirst')}
                </button>
                <button
                  type="button"
                  className={side === 'random' ? 'active' : ''}
                  onClick={() => setSide('random')}
                >
                  {t('play.random')}
                </button>
                <button
                  type="button"
                  className={side === 'w' ? 'active' : ''}
                  onClick={() => setSide('w')}
                >
                  {t('arena.goteSecond')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            {t('auth.cancel')}
          </button>
          <button
            type="button"
            className="primary-solid-btn"
            disabled={isBlockedOfflineBot}
            onClick={() =>
              onStart({
                mode,
                engineKind: bot.engineKind,
                botElo: bot.elo,
                botName: bot.name,
                playerSide: side,
                timeMinutes: tc.minutes,
                incrementSeconds: tc.inc,
              })
            }
          >
            {t('play.startMatch')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface WdoorCatalogItem {
  year: string;
  file: string;
  sizeLabel: string;
  url: string;
  cached: boolean;
}

const FALLBACK_WDOOR_CATALOG: WdoorCatalogItem[] = [
  ['2026', '93 MB'],
  ['2025', '335 MB'],
  ['2024', '338 MB'],
  ['2023', '339 MB'],
  ['2022', '290 MB'],
  ['2021', '352 MB'],
  ['2020', '337 MB'],
  ['2019', '217 MB'],
  ['2018', '107 MB'],
  ['2017', '184 MB'],
  ['2016', '217 MB'],
  ['2015', '182 MB'],
  ['2014', '159 MB'],
  ['2013', '222 MB'],
  ['2012', '167 MB'],
  ['2011', '105 MB'],
  ['2010', '132 MB'],
  ['2009', '85 MB'],
  ['2008', '59 MB'],
].map(([year, sizeLabel]) => ({
  year,
  file: `wdoor${year}.7z`,
  sizeLabel,
  url: `https://wdoor.c.u-tokyo.ac.jp/shogi/archive/wdoor${year}.7z`,
  cached: false,
}));

interface WdoorProgressState {
  active: boolean;
  stage: string;
  year: string;
  percent: number;
  downloadedMb: number;
  totalMb: number;
  message: string;
  error: string | null;
}

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!text) return null;
  if (!contentType.includes('application/json') && text.trim().startsWith('<')) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface ImportModalProps {
  onClose: () => void;
  onImportToDatabase: (games: ParsedDatabaseGame[], openFirstInAnalysis: boolean) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  onClose,
  onImportToDatabase,
}) => {
  const { t } = useI18n();
  const [sourceTab, setSourceTab] = useState<'wdoor' | 'local'>('wdoor');
  const [format, setFormat] = useState<'auto' | DatabaseFormat>('auto');
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState(
    '1 ７六歩(77)\n2 ３四歩(33)\n3 ２六歩(27)\n4 ８四歩(83)\n5 ２五歩(26)',
  );
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Floodgate (wdoor) states
  const [catalog, setCatalog] = useState<WdoorCatalogItem[]>(FALLBACK_WDOOR_CATALOG);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [deviceDir, setDeviceDir] = useState<string>('Browser Downloads & IndexedDB');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [downloadingYear, setDownloadingYear] = useState<string | null>(null);
  const [wdoorLimit, setWdoorLimit] = useState<number>(150);
  const [progress, setProgress] = useState<WdoorProgressState | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    fetch('/api/wdoor/catalog')
      .then(async (r) =>
        r.ok
          ? parseJsonResponse<{ items?: WdoorCatalogItem[]; deviceDir?: string }>(r)
          : null,
      )
      .then((data) => {
        if (!active) return;
        if (data?.items && data.items.length > 0) {
          setCatalog(data.items);
          setBackendOnline(true);
          if (data.deviceDir) setDeviceDir(data.deviceDir);
        } else {
          setBackendOnline(false);
        }
      })
      .catch(() => {
        if (active) setBackendOnline(false);
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!downloadingYear || downloadingYear === 'today') return;
    const timer = window.setInterval(() => {
      fetch('/api/wdoor/progress')
        .then((r) => (r.ok ? parseJsonResponse<WdoorProgressState>(r) : null))
        .then((p) => {
          if (p) setProgress(p);
        })
        .catch(() => {});
    }, 600);
    return () => window.clearInterval(timer);
  }, [downloadingYear]);

  const handleWdoorToday = async () => {
    setError('');
    setStatusMsg('');
    setDownloadingYear('today');
    try {
      const res = await fetch('/api/wdoor/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 18 }),
      });
      const data = await parseJsonResponse<{
        error?: string;
        games?: { csaText: string; filename: string }[];
      }>(res);
      if (!res.ok || !data) {
        throw new Error(
          data?.error ||
            `API /api/wdoor/today merespons HTTP ${res.status} (bukan JSON). Jika Anda baru saja deploy ke Vercel, tunggu build selesai lalu hard-refresh, atau di lokal jalankan "npm run engine".`,
        );
      }

      const parsed: ParsedDatabaseGame[] = [];
      for (const item of data.games ?? []) {
        parsed.push(...parseDatabaseImport(item.csaText, item.filename, 'csa'));
      }
      if (parsed.length === 0) {
        setError('Belum ada partai CSA selesai yang ditemukan untuk hari ini.');
        return;
      }
      onImportToDatabase(parsed, false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke server downloader lokal.',
      );
    } finally {
      setDownloadingYear(null);
    }
  };

  const handleWdoorYearDownload = async (year: string) => {
    setError('');
    setStatusMsg('');
    setDownloadingYear(year);
    setProgress({
      active: true,
      stage: 'downloading',
      year,
      percent: 0,
      downloadedMb: 0,
      totalMb: 0,
      message: `Menghubungi wdoor${year}.7z...`,
      error: null,
    });
    try {
      const res = await fetch('/api/wdoor/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, limit: wdoorLimit }),
      });
      const data = await parseJsonResponse<{
        error?: string;
        fallbackDirectDownload?: boolean;
        archiveUrl?: string;
        filename?: string;
        message?: string;
        savedArchivePath?: string;
        games?: { csaText: string; filename: string }[];
      }>(res);
      if (!res.ok || !data) {
        const directUrl = `https://wdoor.c.u-tokyo.ac.jp/shogi/archive/wdoor${year}.7z`;
        window.open(directUrl, '_blank', 'noopener,noreferrer');
        setStatusMsg(
          `Server ekstraksi lokal tidak aktif (HTTP ${res.status}). Membuka unduhan langsung ${`wdoor${year}.7z`} di browser — ekstrak file .csa lalu masukkan lewat tab Import Local.`,
        );
        return;
      }

      if (data.fallbackDirectDownload && data.archiveUrl) {
        const a = document.createElement('a');
        a.href = data.archiveUrl;
        a.target = '_blank';
        a.rel = 'noreferrer';
        a.download = data.filename || `wdoor${year}.7z`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setStatusMsg(
          data.message ||
            `Download ${data.filename ?? `wdoor${year}.7z`} dimulai di browser.`,
        );
        return;
      }

      const parsed: ParsedDatabaseGame[] = [];
      for (const item of data.games ?? []) {
        parsed.push(...parseDatabaseImport(item.csaText, item.filename, 'csa'));
      }
      if (parsed.length === 0) {
        setError(`Tidak ditemukan partai CSA valid di arsip wdoor${year}.7z.`);
        return;
      }
      setStatusMsg(
        `Berhasil mengimpor ${parsed.length} partai dari wdoor${year}.7z ke perangkat (${data.savedArchivePath ?? deviceDir})!`,
      );
      onImportToDatabase(parsed, false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal mengunduh arsip Floodgate. Pastikan server lokal (npm run engine) aktif.',
      );
    } finally {
      setDownloadingYear(null);
    }
  };

  const handleFilePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const allGames: ParsedDatabaseGame[] = [];
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer();
      const decoded = decodeShogiTextBuffer(buf);
      const parsed = parseDatabaseImport(
        decoded,
        file.name,
        format === 'auto' ? undefined : format,
      );
      allGames.push(...parsed);
    }
    if (allGames.length === 0) {
      setError('No valid games found in the selected file(s).');
      return;
    }
    onImportToDatabase(allGames, allGames.length === 1);
  };

  const handleParseSubmit = (openInAnalysis: boolean) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setError('Paste .kif, .ki2, .csa, or .sfen content or upload a file.');
      return;
    }
    const parsed = parseDatabaseImport(
      trimmed,
      title.trim() ? `${title.trim()}` : '',
      format === 'auto' ? undefined : format,
    );
    if (parsed.length === 0) {
      setError('Could not parse any valid game or SFEN position from this input.');
      return;
    }
    if (title.trim() && parsed.length === 1) {
      parsed[0].title = title.trim();
    }
    onImportToDatabase(parsed, openInAnalysis);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="studio-modal studio-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{t('import.title')}</h3>
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Notification Banner pointing to wdoor.c.u-tokyo.ac.jp/shogi/ */}
          <div className="wdoor-notice-banner">
            <Globe size={17} className="accent-icon" />
            <div className="wdoor-notice-text">
              <div className="wdoor-notice-title">
                Import Database via Web Floodgate Shogi
              </div>
              <div className="wdoor-notice-desc">
                Download arsip partai `.csa` langsung dari{' '}
                <a
                  href="https://wdoor.c.u-tokyo.ac.jp/shogi/"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://wdoor.c.u-tokyo.ac.jp/shogi/ <ExternalLink size={11} />
                </a>
                . File akan disimpan ke penyimpanan perangkat Anda ({' '}
                <code className="mono">{deviceDir}</code> &amp; IndexedDB browser) dan
                otomatis masuk ke daftar database.
              </div>
            </div>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={sourceTab === 'wdoor' ? 'active' : ''}
              onClick={() => {
                setSourceTab('wdoor');
                setError('');
              }}
            >
              {t('import.tabWeb')}
            </button>
            <button
              type="button"
              className={sourceTab === 'local' ? 'active' : ''}
              onClick={() => {
                setSourceTab('local');
                setError('');
              }}
            >
              {t('import.tabLocal')}
            </button>
          </div>

          {sourceTab === 'wdoor' ? (
            <>
              <div className="wdoor-top-actions">
                <button
                  type="button"
                  className="primary-solid-btn"
                  onClick={() => void handleWdoorToday()}
                  disabled={downloadingYear !== null}
                >
                  <CloudDownload size={15} />
                  <span>
                    {downloadingYear === 'today'
                      ? t('import.downloadingToday')
                      : t('import.downloadToday')}
                  </span>
                </button>

                <div className="wdoor-limit-select">
                  <span>{t('import.limitPerArchive')}</span>
                  {[50, 150, 300].map((lim) => (
                    <button
                      key={lim}
                      type="button"
                      className={`pill-choice ${wdoorLimit === lim ? 'selected' : ''}`}
                      onClick={() => setWdoorLimit(lim)}
                    >
                      {lim}
                    </button>
                  ))}
                </div>
              </div>

              {downloadingYear && downloadingYear !== 'today' && progress && (
                <div className="wdoor-progress-box">
                  <div className="wdoor-progress-head">
                    <span>{progress.message}</span>
                    <span className="mono">{progress.percent}%</span>
                  </div>
                  <div className="review-progress-track">
                    <div
                      className="review-progress-fill"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{t('import.yearlyArchives')}</label>
                {backendOnline === false && (
                  <div className="db-drop-hint" style={{ marginBottom: 6 }}>
                    Endpoint `/api/wdoor/catalog` tidak merespons JSON — daftar arsip
                    tetap tersedia untuk unduhan langsung `.7z` di browser.
                  </div>
                )}
                {loadingCatalog && catalog.length === 0 ? (
                  <div className="wdoor-catalog-loading">Memuat daftar arsip wdoor…</div>
                ) : (
                  <div className="wdoor-archive-grid">
                    {catalog.map((item) => {
                      const isBusy = downloadingYear === item.year;
                      return (
                        <button
                          key={item.year}
                          type="button"
                          className={`wdoor-archive-item ${item.cached ? 'cached' : ''}`}
                          onClick={() => void handleWdoorYearDownload(item.year)}
                          disabled={downloadingYear !== null}
                          title={`Download ${item.file} (${item.sizeLabel})`}
                        >
                          <div className="wdoor-item-left">
                            <span className="wdoor-file mono">{item.file}</span>
                            <span className="wdoor-size">{item.sizeLabel}</span>
                          </div>
                          <span className="wdoor-dl-badge">
                            {isBusy
                              ? 'Loading…'
                              : item.cached
                                ? 'Cached • Impor'
                                : 'Download'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">{t('import.uploadFiles')}</label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".kif,.ki2,.csa,.sfen,.usi,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void handleFilePick(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="db-upload-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileUp size={15} />
                  <span>{t('import.chooseFiles')}</span>
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">{t('import.format')}</label>
                <div className="pill-options">
                  {(['auto', 'kif', 'ki2', 'csa', 'sfen'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      className={`pill-choice ${format === fmt ? 'selected' : ''}`}
                      onClick={() => setFormat(fmt)}
                    >
                      {fmt === 'auto' ? t('import.autoDetect') : `.${fmt}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t('import.customTitle')}</label>
                <input
                  type="text"
                  className="studio-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Ryuo Title Match"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('import.pasteContent')}</label>
                <textarea
                  className="studio-textarea mono"
                  rows={5}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setError('');
                  }}
                  placeholder="Paste .kif, .ki2, .csa (supports '/' multi-game), or .sfen lines..."
                />
              </div>
            </>
          )}

          {statusMsg && <div className="db-feedback">{statusMsg}</div>}
          {error && <div className="form-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            {t('auth.close')}
          </button>
          {sourceTab === 'local' && (
            <>
              <button
                type="button"
                className="launcher-cta-btn compact"
                onClick={() => handleParseSubmit(false)}
              >
                {t('import.addToDb')}
              </button>
              <button
                type="button"
                className="primary-solid-btn"
                onClick={() => handleParseSubmit(true)}
              >
                {t('import.importAnalyze')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface AuthProfileModalProps {
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (next: PlayerProfile) => void;
}

export const AuthProfileModal: React.FC<AuthProfileModalProps> = ({
  profile,
  onClose,
  onSave,
}) => {
  const [username, setUsername] = useState(profile.username);
  const [targetElo, setTargetElo] = useState(profile.targetElo);
  const [preferredSide, setPreferredSide] = useState<'b' | 'w' | 'random'>(
    profile.preferredSide,
  );
  const [defaultTimeControl, setDefaultTimeControl] = useState(
    profile.defaultTimeControl,
  );
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...profile,
      username: username.trim() || 'Sente_Studio',
      targetElo,
      preferredSide,
      defaultTimeControl,
      loggedIn: true,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Player Profile & Calibration</h3>
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="segmented-control" style={{ marginBottom: 14 }}>
              <button
                type="button"
                className={authTab === 'signin' ? 'active' : ''}
                onClick={() => setAuthTab('signin')}
              >
                Player Sign In
              </button>
              <button
                type="button"
                className={authTab === 'register' ? 'active' : ''}
                onClick={() => setAuthTab('register')}
              >
                Register Studio ID
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Player Handle</label>
              <input
                type="text"
                className="studio-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your Shogi handle"
              />
            </div>

            {authTab === 'register' && (
              <div className="form-group">
                <label className="form-label">Email (Local Profile Sync)</label>
                <input
                  type="email"
                  className="studio-input"
                  placeholder="player@shogistudio.local"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                Target Elo Calibration: <strong className="mono">{targetElo}</strong>
              </label>
              <input
                type="range"
                min={600}
                max={2400}
                step={50}
                value={targetElo}
                onChange={(e) => setTargetElo(Number(e.target.value))}
                className="studio-range"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Time Control</label>
              <select
                className="studio-input"
                value={defaultTimeControl}
                onChange={(e) => setDefaultTimeControl(e.target.value)}
              >
                <option value="3+0">3 + 0 Blitz</option>
                <option value="5+3">5 + 3 Blitz</option>
                <option value="10+0">10 + 0 Rapid</option>
                <option value="15+10">15 + 10 Classical</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Preferred Side</label>
              <div className="segmented-control three">
                <button
                  type="button"
                  className={preferredSide === 'b' ? 'active' : ''}
                  onClick={() => setPreferredSide('b')}
                >
                  ▲ Sente
                </button>
                <button
                  type="button"
                  className={preferredSide === 'random' ? 'active' : ''}
                  onClick={() => setPreferredSide('random')}
                >
                  Random
                </button>
                <button
                  type="button"
                  className={preferredSide === 'w' ? 'active' : ''}
                  onClick={() => setPreferredSide('w')}
                >
                  △ Gote
                </button>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="primary-solid-btn">
              {authTab === 'signin' ? 'Save & Sign In' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SettingsHelpModalProps {
  mode: 'settings' | 'help';
  boardTheme: 'kaya' | 'walnut';
  onToggleBoardTheme: () => void;
  showEnglishHints: boolean;
  onToggleEnglishHints: () => void;
  notationMode: 'kifu' | 'western';
  onToggleNotationMode: () => void;
  onClose: () => void;
}

export const SettingsHelpModal: React.FC<SettingsHelpModalProps> = ({
  mode,
  boardTheme,
  onToggleBoardTheme,
  showEnglishHints,
  onToggleEnglishHints,
  notationMode,
  onToggleNotationMode,
  onClose,
}) => {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'settings' ? t('settings.title') : t('help.title')}</h3>
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {mode === 'settings' ? (
            <div className="settings-list">
              <div className="setting-row">
                <div>
                  <div className="setting-title">{t('settings.language')}</div>
                  <div className="setting-desc">{t('settings.languageDesc')}</div>
                </div>
                <select
                  className="studio-input lang-settings-select"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as LocaleCode)}
                  aria-label={t('settings.language')}
                >
                  {SUPPORTED_LOCALES.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      [{opt.shortCode}] {opt.nativeLabel} — {opt.country}
                    </option>
                  ))}
                </select>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-title">{t('settings.boardPalette')}</div>
                  <div className="setting-desc">{t('settings.boardPaletteDesc')}</div>
                </div>
                <button type="button" className="launcher-cta-btn compact" onClick={onToggleBoardTheme}>
                  {boardTheme === 'kaya' ? 'Kaya Wood' : 'Cream / Walnut'}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-title">{t('settings.letterBadges')}</div>
                  <div className="setting-desc">{t('settings.letterBadgesDesc')}</div>
                </div>
                <button type="button" className="launcher-cta-btn compact" onClick={onToggleEnglishHints}>
                  {showEnglishHints ? t('settings.enabled') : t('settings.disabled')}
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-title">{t('settings.notationFormat')}</div>
                  <div className="setting-desc">{t('settings.notationFormatDesc')}</div>
                </div>
                <button type="button" className="launcher-cta-btn compact" onClick={onToggleNotationMode}>
                  {notationMode === 'kifu' ? 'Japanese Kifu' : 'Western'}
                </button>
              </div>
            </div>
          ) : (
            <div className="help-guide">
              <p>
                <strong>Drops (Komadai):</strong> Captured enemy pieces join your piece stand and
                can be dropped back onto any empty square on your turn as your own unpromoted piece.
              </p>
              <p>
                <strong>Promotion Zone:</strong> Entering, moving inside, or leaving the farthest 3
                ranks lets pieces (except King &amp; Gold) promote—turning crimson with enhanced movement.
              </p>
              <p>
                <strong>Special Drop Rules:</strong> You cannot drop two unpromoted Pawns on the same
                file (<em>Nifu</em>), drop a piece where it has no future legal move, or drop a Pawn
                for immediate checkmate (<em>Uchifuzume</em>).
              </p>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="primary-solid-btn" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
