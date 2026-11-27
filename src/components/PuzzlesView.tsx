import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  Puzzle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PUZZLE_LEVELS, SHOGI_PUZZLES } from '../data/puzzles';
import {
  GUIDE_TOPICS,
  GuideTopicId,
  PIECE_GUIDE_LIST,
  SHOGI_GLOSSARY,
} from '../data/shogiGuide';
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
import { useI18n } from '../i18n';
import { ShogiPieceSvg } from './ShogiPieceSvg';

interface PuzzlesViewProps {
  boardTheme: 'kaya' | 'walnut';
  showEnglishHints: boolean;
}

const FILES = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const RANKS_JP = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SOLVED_STORAGE_KEY = 'shogi_studio_puzzles_solved_v1';

const MovePatternGrid: React.FC<{ grid: string[]; label: string; promoted?: boolean }> = ({
  grid,
  label,
  promoted,
}) => (
  <div className="move-grid-wrap">
    <div className={`move-grid-label ${promoted ? 'promoted' : ''}`}>{label}</div>
    <div className="move-grid-5x5" aria-label={label}>
      {grid.map((rowStr, r) =>
        rowStr.split('').map((ch, c) => {
          let cls = 'mg-cell';
          let sym = '';
          if (ch === 'C') {
            cls += promoted ? ' mg-center promoted' : ' mg-center';
            sym = '▲';
          } else if (ch === 'S') {
            cls += ' mg-step';
            sym = '●';
          } else if (ch === 'R') {
            cls += ' mg-ray';
            sym = '✦';
          } else if (ch === 'J') {
            cls += ' mg-jump';
            sym = '★';
          }
          return (
            <span key={`${r}-${c}`} className={cls}>
              {sym}
            </span>
          );
        }),
      )}
    </div>
  </div>
);

export const PuzzlesView: React.FC<PuzzlesViewProps> = ({
  boardTheme,
  showEnglishHints,
}) => {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<'practice' | 'guide'>('practice');
  const [guideTopic, setGuideTopic] = useState<GuideTopicId>('basics');
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

  // Level 6 Byoyomi countdown timer (paused while reading Beginner Guide)
  useEffect(() => {
    if (viewMode !== 'practice' || byoyomiLeft === null || status !== 'solving') return;
    if (byoyomiLeft <= 0) {
      setStatus('timeout');
      setStreak(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setByoyomiLeft((t) => (t !== null ? t - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [byoyomiLeft, status, viewMode]);

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

  const activeGuideMeta =
    GUIDE_TOPICS.find((t) => t.id === guideTopic) ?? GUIDE_TOPICS[0];

  return (
    <div className="puzzles-layout">
      <aside className="repertoire-sidebar">
        <div className="panel-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {viewMode === 'practice' ? (
              <Puzzle size={15} className="accent-icon" />
            ) : (
              <GraduationCap size={15} className="accent-icon" />
            )}
            <span>
              {viewMode === 'practice' ? t('puzzles.header') : t('puzzles.guideHeader')}
            </span>
          </div>
          <span className="mono-pill">
            {viewMode === 'practice'
              ? `${solvedIds.length}/${SHOGI_PUZZLES.length}`
              : '5'}
          </span>
        </div>

        {/* Mode Switcher: Latihan Puzzle vs Panduan & Tutorial Pemula */}
        <div className="puzzle-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'practice'}
            className={`puzzle-mode-btn ${viewMode === 'practice' ? 'active' : ''}`}
            onClick={() => setViewMode('practice')}
          >
            <Puzzle size={13} />
            <span>{t('puzzles.tabPractice')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'guide'}
            className={`puzzle-mode-btn ${viewMode === 'guide' ? 'active' : ''}`}
            onClick={() => setViewMode('guide')}
          >
            <BookOpen size={13} />
            <span>{t('puzzles.tabGuide')}</span>
          </button>
        </div>

        {viewMode === 'practice' ? (
          <>
            <div className="puzzle-stats-strip">
              <div className="stat-box">
                <Flame size={15} className="warn-text" />
                <span>{t('puzzles.streak')}: {streak}</span>
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
                        {isSolved ? (
                          <span className="win-text">✓ Solved</span>
                        ) : (
                          `Mate ${p.movesToMate}`
                        )}
                      </span>
                    </div>
                    <div className="rep-name">{p.title}</div>
                    <div className="rep-jp">{p.theme}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="repertoire-list">
            {GUIDE_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={`repertoire-item ${guideTopic === topic.id ? 'active' : ''}`}
                onClick={() => setGuideTopic(topic.id)}
              >
                <div className="rep-item-top">
                  <span className="rep-code">{topic.badge}</span>
                  <span className="rep-cat">Pemula</span>
                </div>
                <div className="rep-name">{topic.title}</div>
                <div className="rep-jp">{topic.subtitle}</div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {viewMode === 'guide' ? (
        <div className="guide-main-canvas">
          <div className="guide-container">
            <div className="guide-hero">
              <div className="guide-hero-top">
                <span className="mono-pill">{activeGuideMeta.badge} • Panduan Shogi</span>
                <button
                  type="button"
                  className="primary-solid-btn"
                  onClick={() => {
                    loadPuzzle(0);
                    setViewMode('practice');
                  }}
                >
                  <span>Coba Puzzle Level 1</span>
                  <ArrowRight size={14} />
                </button>
              </div>
              <h2 className="guide-hero-title">{activeGuideMeta.title}</h2>
              <p className="guide-hero-sub">{activeGuideMeta.subtitle}</p>
            </div>

            {guideTopic === 'basics' && (
              <div className="guide-section-stack">
                <div className="guide-card">
                  <div className="guide-card-title">
                    <Compass size={15} className="accent-icon" />
                    <span>Apa Itu Shogi (Catur Jepang)?</span>
                  </div>
                  <p className="guide-text">
                    <strong>Shogi (将棋)</strong> dimainkan di papan berukuran{' '}
                    <strong>9×9 (81 petak)</strong> dengan 20 bidak untuk masing-masing
                    pemain. Tujuan utamanya sama seperti catur internasional: membuat{' '}
                    <strong>Raja lawan skakmat (Tsumi / 詰み)</strong>.
                  </p>
                  <div className="guide-callout-grid">
                    <div className="guide-mini-card">
                      <strong>1. Arah Menentukan Pemilik</strong>
                      <p>
                        Semua bidak berwarna kayu yang sama. Bidak yang ujung lancipnya
                        menghadap ke atas adalah milik Anda (<strong>▲ Sente</strong>),
                        sedangkan yang menghadap ke bawah adalah milik lawan (
                        <strong>△ Gote</strong>).
                      </p>
                    </div>
                    <div className="guide-mini-card">
                      <strong>2. Bidak Tidak Pernah Mati (Drop)</strong>
                      <p>
                        Bidak lawan yang Anda tangkap masuk ke{' '}
                        <strong>Komadai (Tangan)</strong> dan dapat dijatuhkan kembali ke
                        papan sebagai pasukan Anda! Karena itu, Shogi jarang berakhir seri
                        dan makin menegangkan menjelang akhir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <Sparkles size={15} className="accent-icon" />
                    <span>Sente (▲) vs Gote (△) &amp; Cara Baca Koordinat</span>
                  </div>
                  <ul className="guide-list">
                    <li>
                      <strong>Sente (▲ Hitam) jalan pertama:</strong> Kebalikan dari catur
                      Barat, di Shogi justru simbol hitam (▲) yang melangkah lebih dulu,
                      sedangkan simbol putih (△ Gote) melangkah kedua.
                    </li>
                    <li>
                      <strong>Kolom (File) 9 → 1:</strong> Dibaca dari kanan ke kiri (kolom
                      paling kanan adalah <code>1</code>, paling kiri adalah <code>9</code>).
                    </li>
                    <li>
                      <strong>Baris (Rank) 一 → 九 (atau a → i):</strong> Dibaca dari atas ke
                      bawah. Baris <code>1–3 (一–三 / a–c)</code> adalah wilayah lawan
                      sekaligus zona promosi Anda.
                    </li>
                    <li>
                      <strong>Contoh Notasi:</strong> <code>7g7f</code> artinya bidak dari
                      petak <code>7g</code> maju ke <code>7f</code>. Tanda <code>*</code>{' '}
                      seperti <code>G*5b</code> berarti <em>drop</em> (menjatuhkan) Emas dari
                      tangan ke petak <code>5b</code>. Tanda <code>+</code> seperti{' '}
                      <code>4b2b+</code> berarti bidak promosi.
                    </li>
                  </ul>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <Lightbulb size={15} className="accent-icon" />
                    <span>3 Fase Utama Permainan Shogi</span>
                  </div>
                  <div className="guide-phase-grid">
                    <div className="guide-mini-card">
                      <span className="guide-pill-blue">1. Joban (序盤 • Pembukaan)</span>
                      <p>
                        Tentukan posisi Benteng (<em>Ibisha</em> diam di kanan atau{' '}
                        <em>Furibisha</em> digeser ke kiri) lalu lindungi Raja di dalam{' '}
                        <strong>Benteng (Kakoi)</strong> seperti <em>Mino</em> atau{' '}
                        <em>Yagura</em>.
                      </p>
                    </div>
                    <div className="guide-mini-card">
                      <span className="guide-pill-blue">2. Chūban (中盤 • Tengah)</span>
                      <p>
                        Buka bentrokan, tukar bidak secara menguntungkan, kumpulkan amunisi{' '}
                        <strong>Mochigoma</strong>, dan promosikan Benteng/Gajah ke kamp
                        lawan.
                      </p>
                    </div>
                    <div className="guide-mini-card">
                      <span className="guide-pill-blue">3. Shūban (終盤 • Akhir)</span>
                      <p>
                        Adu kecepatan skakmat! Di fase ini, jarak langkah menuju skakmat
                        (tempo) sering jauh lebih krusial daripada keunggulan jumlah bidak.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {guideTopic === 'pieces' && (
              <div className="guide-section-stack">
                <div className="guide-legend-bar">
                  <span className="legend-chip">
                    <strong className="mg-legend-dot step">●</strong> Langkah 1 petak
                  </span>
                  <span className="legend-chip">
                    <strong className="mg-legend-dot ray">✦</strong> Meluncur bebas (jarak
                    jauh)
                  </span>
                  <span className="legend-chip">
                    <strong className="mg-legend-dot jump">★</strong> Melompati bidak (khusus
                    Kuda)
                  </span>
                  <span className="legend-chip">
                    Tip: aktifkan <strong>English Hints</strong> di menu View untuk melihat
                    huruf K/R/B/G/S/N/L/P pada papan.
                  </span>
                </div>

                <div className="piece-guide-grid">
                  {PIECE_GUIDE_LIST.map((item) => (
                    <div key={item.type} className="piece-guide-card">
                      <div className="piece-guide-header">
                        <div className="piece-guide-svg-row">
                          <div className="piece-guide-preview">
                            <ShogiPieceSvg
                              type={item.type}
                              side="b"
                              showEnglishHint={showEnglishHints}
                            />
                          </div>
                          {item.promotedType && (
                            <>
                              <ArrowRight size={13} className="muted-icon" />
                              <div className="piece-guide-preview">
                                <ShogiPieceSvg
                                  type={item.promotedType}
                                  side="b"
                                  showEnglishHint={showEnglishHints}
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <div className="piece-guide-meta">
                          <div className="piece-guide-name">
                            {item.nameId}{' '}
                            <span className="piece-guide-kanji">({item.kanji})</span>
                          </div>
                          <div className="piece-guide-sub">
                            {item.nameJp} • Nilai: <strong>{item.valuePoints}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="piece-guide-diagrams">
                        <MovePatternGrid grid={item.normalGrid} label="Gerakan Normal" />
                        {item.promotedGrid && (
                          <MovePatternGrid
                            grid={item.promotedGrid}
                            label={`Promosi: ${item.promotedKanji}`}
                            promoted
                          />
                        )}
                      </div>

                      <p className="piece-guide-desc">{item.summary}</p>
                      {item.promotedSummary && (
                        <div className="piece-guide-promo-note">
                          <strong>{item.promotedNameId}:</strong> {item.promotedSummary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {guideTopic === 'promotion' && (
              <div className="guide-section-stack">
                <div className="guide-card">
                  <div className="guide-card-title">
                    <Sparkles size={15} className="accent-icon" />
                    <span>Zona Promosi (3 Baris Terakhir Lawan)</span>
                  </div>
                  <p className="guide-text">
                    Tiga baris paling ujung di sisi lawan (<strong>baris 一, 二, 三</strong>{' '}
                    atau <code>a, b, c</code> untuk Sente ▲) disebut{' '}
                    <strong>Zona Promosi</strong>. Semua bidak kecuali{' '}
                    <strong>Raja (玉)</strong> dan <strong>Jenderal Emas (金)</strong> bisa
                    dipromosikan.
                  </p>
                  <div className="promo-zone-diagram">
                    <div className="promo-zone-band highlight">
                      <span>Baris 一 (a) • Baris 二 (b) • Baris 三 (c)</span>
                      <strong>ZONA PROMOSI ▲ SENTE (3 Baris Wilayah Lawan)</strong>
                    </div>
                    <div className="promo-zone-band middle">
                      <span>Baris 四 (d) • Baris 五 (e) • Baris 六 (f)</span>
                      <span>Area Tengah (Netral)</span>
                    </div>
                    <div className="promo-zone-band">
                      <span>Baris 七 (g) • Baris 八 (h) • Baris 九 (i)</span>
                      <span>Wilayah Sendiri (Zona Promosi △ Gote)</span>
                    </div>
                  </div>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <CheckCircle2 size={15} className="win-text" />
                    <span>Kapan Bidak Boleh &amp; Wajib Promosi?</span>
                  </div>
                  <ul className="guide-list">
                    <li>
                      <strong>3 Kondisi Boleh Promosi:</strong> (1) Masuk ke zona promosi,
                      (2) Bergerak di dalam zona promosi, atau (3) Keluar dari zona promosi.
                      Saat memindahkan bidak di kondisi ini, Shogi Studio akan memunculkan
                      pilihan <strong>Promote / Keep</strong>.
                    </li>
                    <li>
                      <strong>Promosi Wajib (Otomatis):</strong> Pion (<code>P</code>) dan
                      Tombak (<code>L</code>) yang mencapai baris paling ujung (<code>一</code>
                      ), serta Kuda (<code>N</code>) yang mencapai 2 baris paling ujung (
                      <code>一</code> atau <code>二</code>), <strong>wajib promosi</strong>{' '}
                      karena jika tidak mereka tidak akan pernah bisa melangkah lagi.
                    </li>
                    <li>
                      <strong>Tidak Bisa Promosi Saat Drop:</strong> Bidak yang baru saja
                      dijatuhkan dari tangan langsung ke zona promosi masuk dalam wujud
                      normal dulu. Ia baru bisa promosi saat melangkah di giliran berikutnya.
                    </li>
                    <li>
                      <strong>Kembali Normal Jika Tertangkap:</strong> Jika bidak promosi
                      (mis. Naga <code>龍</code> atau Tokin <code>と</code>) ditangkap lawan,
                      ia kembali menjadi wujud dasar (Benteng <code>飛</code> atau Pion{' '}
                      <code>歩</code>) di tangan lawan.
                    </li>
                  </ul>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <Lightbulb size={15} className="accent-icon" />
                    <span>Tips Pemula: Kapan Sebaiknya Promosi?</span>
                  </div>
                  <p className="guide-text">
                    <strong>Benteng (飛), Gajah (角), Pion (歩), Tombak (香)</strong> hampir
                    selalu lebih kuat setelah promosi (hampir selalu pilih{' '}
                    <strong>Promote</strong>!). Pengecualian biasanya hanya{' '}
                    <strong>Perak (銀)</strong> jika Anda masih membutuhkan gerakan mundur
                    diagonal, atau <strong>Kuda (桂)</strong> jika lompatannya langsung
                    mengancam Raja lawan.
                  </p>
                </div>
              </div>
            )}

            {guideTopic === 'drops-rules' && (
              <div className="guide-section-stack">
                <div className="guide-card">
                  <div className="guide-card-title">
                    <Sparkles size={15} className="accent-icon" />
                    <span>Aturan Drop / Mochigoma (Bidak di Tangan)</span>
                  </div>
                  <ul className="guide-list">
                    <li>
                      Pada giliran Anda, Anda boleh memilih antara{' '}
                      <strong>menggerakkan 1 bidak di papan</strong> ATAU{' '}
                      <strong>menjatuhkan (drop) 1 bidak dari tangan</strong> ke petak kosong
                      mana saja.
                    </li>
                    <li>
                      Anda boleh melakukan drop untuk langsung memberi skak (<em>Ōte</em>),
                      menutup jalur serangan Benteng/Gajah/Tombak lawan, atau membentuk
                      garpuan (<em>fork</em>) ke dua bidak sekaligus.
                    </li>
                    <li>
                      Di papan Shogi Studio, cukup klik bidak di bar{' '}
                      <strong>Bidak di Tangan (Komadai)</strong> lalu klik petak hijau/titik
                      legal pada papan.
                    </li>
                  </ul>
                </div>

                <div className="guide-card danger-card">
                  <div className="guide-card-title">
                    <ShieldAlert size={16} className="blunder-text" />
                    <span>3 Larangan Wajib (Kinjite) — Dilarang Keras Saat Drop!</span>
                  </div>
                  <div className="guide-rules-grid">
                    <div className="guide-rule-item">
                      <div className="rule-badge">Larangan 1 • Nifu (二歩)</div>
                      <strong>Dilarang 2 Pion di Satu Kolom</strong>
                      <p>
                        Anda TIDAK BOLEH men-drop Pion di kolom vertikal (file) yang sudah
                        memiliki Pion Anda sendiri yang belum promosi.{' '}
                        <em>
                          (Catatan: jika Pion Anda di kolom itu sudah menjadi Tokin +P, Anda
                          boleh drop Pion baru di kolom tersebut.)
                        </em>
                      </p>
                    </div>
                    <div className="guide-rule-item">
                      <div className="rule-badge">Larangan 2 • Uchifuzume (打ち歩詰め)</div>
                      <strong>Dilarang Skakmat Instan Pakai Drop Pion</strong>
                      <p>
                        Anda TIDAK BOLEH langsung men-skakmat Raja lawan dengan men-drop Pion
                        dari tangan.{' '}
                        <em>
                          (Skak biasa dengan drop Pion BOLEH asal lawan masih punya cara
                          lolos; dan skakmat dengan memajukan Pion yang sudah ada di papan
                          juga BOLEH!)
                        </em>
                      </p>
                    </div>
                    <div className="guide-rule-item">
                      <div className="rule-badge">Larangan 3 • Bidak Buntu</div>
                      <strong>Dilarang Drop di Petak Tanpa Langkah Legal</strong>
                      <p>
                        Pion (<code>P</code>) dan Tombak (<code>L</code>) tidak boleh di-drop
                        di baris paling ujung (<code>一</code>). Kuda (<code>N</code>) tidak
                        boleh di-drop di 2 baris paling ujung (<code>一</code> &amp;{' '}
                        <code>二</code>).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <AlertTriangle size={15} className="warn-text" />
                    <span>Aturan Khusus Lainnya</span>
                  </div>
                  <ul className="guide-list">
                    <li>
                      <strong>Sennichite (Pengulangan 4×):</strong> Jika posisi papan, bidak
                      di tangan, dan giliran yang persis sama terulang 4 kali, partai
                      dinyatakan seri/diulang (kecuali jika disebabkan skak terus-menerus /{' '}
                      <em>Renzoku Ōte</em>, maka pihak yang terus menskak dinyatakan kalah!).
                    </li>
                    <li>
                      <strong>Impasse / Jishogi (持将棋):</strong> Jika kedua Raja berhasil
                      masuk ke zona promosi lawan dan tidak ada yang bisa skakmat, pemenang
                      ditentukan dari perhitungan poin bidak (Benteng/Gajah = 5 poin, bidak
                      lain = 1 poin, syarat minimal 24 poin).
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {guideTopic === 'tutorial-tips' && (
              <div className="guide-section-stack">
                <div className="guide-card">
                  <div className="guide-card-title">
                    <Puzzle size={15} className="accent-icon" />
                    <span>Tutorial: Cara Menyelesaikan Puzzle Tsume-Shogi</span>
                  </div>
                  <ol className="guide-ordered-list">
                    <li>
                      <strong>Setiap Langkah Penyerang Harus Skak (Ōte):</strong> Di puzzle
                      Tsume-Shogi (Level 1, 2, 3, 5, 6), setiap langkah Anda harus mengancam
                      Raja lawan secara langsung agar lawan tidak punya waktu menyerang balik.
                    </li>
                    <li>
                      <strong>Pengecualian Level 4 (Hisshi / Brinkmate):</strong> Pada Level
                      4, Anda mencari langkah tenang (bukan skak) yang menutup semua jalur
                      kabur Raja lawan sehingga tidak ada pertahanan apa pun yang bisa
                      menghentikan skakmat di giliran berikutnya.
                    </li>
                    <li>
                      <strong>Selalu Cek Komadai (Bidak di Tangan):</strong> Mayoritas pola
                      skakmat di Shogi menggunakan bidak di tangan! Pola terpenting yang wajib
                      dihafal adalah <strong>Atamakin (Kepala Emas)</strong>: jatuhkan Emas
                      tepat di depan Raja lawan (petak kepala) sambil dilindungi oleh bidak
                      Anda yang lain.
                    </li>
                    <li>
                      <strong>Gunakan Hint &amp; Retry:</strong> Jika bingung di puzzle
                      tertentu, klik <strong>Tampilkan Hint</strong> di panel kanan untuk
                      membaca petunjuk polanya.
                    </li>
                  </ol>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <Lightbulb size={15} className="accent-icon" />
                    <span>5 Tips Emas untuk Pemula Shogi</span>
                  </div>
                  <div className="guide-tips-list">
                    <div className="guide-tip-row">
                      <span className="tip-num">1</span>
                      <div>
                        <strong>Jangan Biarkan Raja di Tengah (5九):</strong> Raja di tengah
                        mudah diserang dari kiri, kanan, maupun depan. Pindahkan Raja ke
                        samping dan lindungi dengan Emas + Perak (<em>Mino</em> atau{' '}
                        <em>Yagura</em>).
                      </div>
                    </div>
                    <div className="guide-tip-row">
                      <span className="tip-num">2</span>
                      <div>
                        <strong>Buka Jalur Gajah &amp; Benteng Sejak Awal:</strong> Langkah
                        pertama paling populer untuk pemula adalah <code>7六歩</code> (buka
                        diagonal Gajah) atau <code>2六歩</code> (aktifkan jalur Benteng).
                      </div>
                    </div>
                    <div className="guide-tip-row">
                      <span className="tip-num">3</span>
                      <div>
                        <strong>Promosikan Pion Jadi Tokin:</strong> Pion yang promosi menjadi
                        Tokin punya kekuatan setara Emas, namun jika tertangkap lawan nilainya
                        hanya 1 Pion. Sangat aman untuk membongkar benteng lawan!
                      </div>
                    </div>
                    <div className="guide-tip-row">
                      <span className="tip-num">4</span>
                      <div>
                        <strong>Waspadai Lubang Drop di Sekitar Raja:</strong> Sebelum maju
                        menyerang, pastikan lawan tidak bisa langsung men-drop Emas, Perak,
                        atau Benteng di belakang pertahanan Anda.
                      </div>
                    </div>
                    <div className="guide-tip-row">
                      <span className="tip-num">5</span>
                      <div>
                        <strong>Latih 1-te &amp; 3-te Tsume Setiap Hari:</strong> Menguasai
                        pola skakmat pendek (Level 1–2 di tab Latihan Puzzle) adalah cara
                        tercepat untuk langsung meningkatkan kemampuan bermain Shogi.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="guide-card">
                  <div className="guide-card-title">
                    <BookOpen size={15} className="accent-icon" />
                    <span>Glosarium Istilah Penting Shogi</span>
                  </div>
                  <div className="glossary-grid">
                    {SHOGI_GLOSSARY.map((g) => (
                      <div key={g.term} className="glossary-item">
                        <div className="glossary-head">
                          <strong>{g.term}</strong>
                          <span className="glossary-jp">{g.jp}</span>
                        </div>
                        <p>{g.meaning}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="guide-bottom-nav">
              {GUIDE_TOPICS.findIndex((t) => t.id === guideTopic) > 0 && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    const idx = GUIDE_TOPICS.findIndex((t) => t.id === guideTopic);
                    setGuideTopic(GUIDE_TOPICS[idx - 1].id);
                  }}
                >
                  ← Bab Sebelumnya
                </button>
              )}
              <div style={{ flex: 1 }} />
              {GUIDE_TOPICS.findIndex((t) => t.id === guideTopic) <
              GUIDE_TOPICS.length - 1 ? (
                <button
                  type="button"
                  className="primary-solid-btn"
                  onClick={() => {
                    const idx = GUIDE_TOPICS.findIndex((t) => t.id === guideTopic);
                    setGuideTopic(GUIDE_TOPICS[idx + 1].id);
                  }}
                >
                  <span>Bab Berikutnya</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-solid-btn"
                  onClick={() => {
                    loadPuzzle(0);
                    setViewMode('practice');
                  }}
                >
                  <span>Mulai Latihan Puzzle Level 1</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>

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
            <strong>{t('puzzles.cognitiveFocus')}</strong> {levelMeta.cognitiveFocus}
          </div>
          <div className="curriculum-row">
            <strong>{t('puzzles.strategyRelevance')}</strong> {levelMeta.realWorldRelevance}
          </div>
        </div>

        {status === 'solved' && (
          <div className="puzzle-feedback success">
            <CheckCircle2 size={18} />
            <div>
              <strong>Level {puzzle.level} ✓</strong>
              <div>{t('puzzles.solvedDesc')}</div>
            </div>
          </div>
        )}

        {(status === 'wrong' || status === 'timeout') && (
          <div className="puzzle-feedback error">
            <XCircle size={18} />
            <div>
              <strong>
                {status === 'timeout' ? t('puzzles.timeoutTitle') : t('puzzles.wrongTitle')}
              </strong>
              <div>{t('puzzles.retryHint')}</div>
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
            <span>{showHint ? t('puzzles.hideHint') : t('puzzles.showHint')}</span>
          </button>

          <button
            type="button"
            className="action-pill-btn"
            onClick={() => loadPuzzle(puzzleIdx)}
          >
            <RotateCcw size={14} />
            <span>{t('puzzles.retry')}</span>
          </button>

          {puzzleIdx < SHOGI_PUZZLES.length - 1 && (
            <button
              type="button"
              className="primary-solid-btn full-width"
              onClick={() => loadPuzzle(puzzleIdx + 1)}
            >
              {t('puzzles.next')}
            </button>
          )}

          <button
            type="button"
            className="guide-shortcut-btn"
            onClick={() => setViewMode('guide')}
          >
            <GraduationCap size={14} />
            <span>{t('puzzles.openGuide')}</span>
          </button>
        </div>
      </aside>
        </>
      )}
    </div>
  );
};
