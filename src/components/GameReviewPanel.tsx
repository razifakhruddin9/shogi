import React from 'react';
import { Award, RotateCcw, TrendingUp } from 'lucide-react';
import {
  CATEGORY_MAP,
  FullGameReview,
  REVIEW_CATEGORIES,
} from '../engine/gameReview';
import { Side } from '../engine/types';

interface GameReviewPanelProps {
  review: FullGameReview | null;
  loading: boolean;
  progress: { done: number; total: number } | null;
  userSide: Side;
  senteName: string;
  goteName: string;
  viewPly: number;
  onSelectPly: (ply: number) => void;
  onRematch?: () => void;
  onRunReview: () => void;
}

function clampCp(cp: number): number {
  return Math.max(-1200, Math.min(1200, cp));
}

function accuracyColor(acc: number): string {
  if (acc >= 80) return 'var(--semantic-win)';
  if (acc >= 60) return 'var(--accent-blue-ink)';
  if (acc >= 40) return 'var(--semantic-warn)';
  return 'var(--semantic-blunder)';
}

export const GameReviewPanel: React.FC<GameReviewPanelProps> = ({
  review,
  loading,
  progress,
  userSide,
  senteName,
  goteName,
  viewPly,
  onSelectPly,
  onRematch,
  onRunReview,
}) => {
  if (loading) {
    const pct =
      progress && progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : 0;
    return (
      <div className="review-panel-scroll">
        <div className="review-loading-card">
          <div className="review-loading-title">Menyusun Ulasan Permainan…</div>
          <div className="review-loading-sub">
            Mengevaluasi setiap langkah dengan engine ({progress?.done ?? 0}/
            {progress?.total ?? 0})
          </div>
          <div className="review-progress-track">
            <div className="review-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="review-panel-scroll">
        <div className="review-loading-card">
          <div className="review-loading-title">Ulasan Permainan Belum Dibuat</div>
          <div className="review-loading-sub">
            Jalankan analisis langkah untuk melihat grafik keunggulan, skor akurasi
            0–100, keterampilan bermain, dan rincian jenis tindakan.
          </div>
          <button
            type="button"
            className="primary-solid-btn"
            onClick={onRunReview}
          >
            Mulai Ulasan Permainan
          </button>
        </div>
      </div>
    );
  }

  const userAcc = userSide === 'b' ? review.senteAccuracy : review.goteAccuracy;
  const oppAcc = userSide === 'b' ? review.goteAccuracy : review.senteAccuracy;
  const userSkill = userSide === 'b' ? review.senteSkill : review.goteSkill;
  const userName = userSide === 'b' ? senteName : goteName;

  // Build SVG graph coordinates (width=300, height=110)
  const W = 300;
  const H = 110;
  const midY = H / 2;
  const plies = review.plies;
  const totalPts = Math.max(1, plies.length - 1);

  const coords = plies.map((p, idx) => {
    const x = (idx / totalPts) * W;
    const norm = clampCp(p.scoreCp) / 1200; // -1..+1
    const y = midY - norm * (midY - 8);
    return { x, y, ply: p };
  });

  const linePath = coords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${W} ${midY} L 0 ${midY} Z`
      : '';

  const activePt = coords[Math.min(viewPly, coords.length - 1)];

  return (
    <div className="review-panel-scroll">
      {/* 1. Skor Akurasi Profil Pengguna (0-100) */}
      <section className="review-section">
        <div className="review-section-title">
          <Award size={14} className="accent-icon" />
          <span>Akurasi Profil ({userName})</span>
        </div>

        <div className="accuracy-cards-pair">
          <div className={`accuracy-box ${userSide === 'b' ? 'is-user' : ''}`}>
            <span className="acc-side" title={senteName}>
              ▲ {senteName}
            </span>
            <span
              className="acc-big mono"
              style={{ color: accuracyColor(review.senteAccuracy) }}
            >
              {review.senteAccuracy.toFixed(1)}
            </span>
            <span className="acc-scale">/ 100</span>
          </div>
          <div className={`accuracy-box ${userSide === 'w' ? 'is-user' : ''}`}>
            <span className="acc-side" title={goteName}>
              △ {goteName}
            </span>
            <span
              className="acc-big mono"
              style={{ color: accuracyColor(review.goteAccuracy) }}
            >
              {review.goteAccuracy.toFixed(1)}
            </span>
            <span className="acc-scale">/ 100</span>
          </div>
        </div>
      </section>

      {/* 2. Keterampilan (Performance Rating & Fase Permainan) */}
      <section className="review-section">
        <div className="review-skill-header">
          <span>Keterampilan</span>
          <span className="skill-elo-badge mono">
            ~{userSkill.estimatedElo} Elo • {userSkill.tierLabel}
          </span>
        </div>

        <div className="skill-bars-list">
          <div className="skill-bar-row">
            <span className="skill-name">Pembukaan</span>
            <div className="skill-track">
              <div
                className="skill-fill"
                style={{ width: `${userSkill.opening}%` }}
              />
            </div>
            <span className="skill-val mono">{Math.round(userSkill.opening)}</span>
          </div>
          <div className="skill-bar-row">
            <span className="skill-name">Tengah</span>
            <div className="skill-track">
              <div
                className="skill-fill"
                style={{ width: `${userSkill.middlegame}%` }}
              />
            </div>
            <span className="skill-val mono">{Math.round(userSkill.middlegame)}</span>
          </div>
          <div className="skill-bar-row">
            <span className="skill-name">Akhir</span>
            <div className="skill-track">
              <div
                className="skill-fill"
                style={{ width: `${userSkill.endgame}%` }}
              />
            </div>
            <span className="skill-val mono">{Math.round(userSkill.endgame)}</span>
          </div>
        </div>
        <div className="skill-summary-note">
          Skor Anda <strong>{userAcc.toFixed(1)}</strong> vs lawan{' '}
          <strong>{oppAcc.toFixed(1)}</strong> ({review.engineLabel})
        </div>
      </section>

      {/* 3. Grafik Keunggulan Setiap Langkah */}
      <section className="review-section">
        <div className="review-skill-header">
          <span className="graph-title-inline">
            <TrendingUp size={13} className="accent-icon" />
            <span>Grafik Keunggulan Langkah</span>
          </span>
          <span className="mono-pill">Ply {viewPly}</span>
        </div>

        <div className="adv-graph-box">
          <svg viewBox={`0 0 ${W} ${H}`} className="adv-graph-svg">
            {/* Gote half background */}
            <rect x="0" y={midY} width={W} height={midY} fill="#141517" />
            {/* Sente half background */}
            <rect x="0" y="0" width={W} height={midY} fill="#1d2026" />
            {/* Zero advantage baseline */}
            <line
              x1="0"
              y1={midY}
              x2={W}
              y2={midY}
              stroke="#3b3f47"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {areaPath && (
              <path d={areaPath} fill="rgba(77, 163, 247, 0.22)" />
            )}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#F3F4F6"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            )}

            {/* Active ply cursor */}
            {activePt && (
              <line
                x1={activePt.x}
                y1="0"
                x2={activePt.x}
                y2={H}
                stroke="#4DA3F7"
                strokeWidth="1.4"
              />
            )}

            {/* Clickable move dots */}
            {coords.map((pt) => {
              const meta = CATEGORY_MAP[pt.ply.category];
              const isSelected = pt.ply.ply === viewPly;
              const isNotable =
                isSelected ||
                ['brilliant', 'great', 'mistake', 'miss', 'blunder'].includes(
                  pt.ply.category,
                );
              return (
                <g
                  key={pt.ply.ply}
                  className="graph-node"
                  onClick={() => onSelectPly(pt.ply.ply)}
                >
                  <circle cx={pt.x} cy={pt.y} r="7" fill="transparent" />
                  {isNotable && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 4.2 : 2.8}
                      fill={meta.color}
                      stroke="#141517"
                      strokeWidth="1"
                    />
                  )}
                </g>
              );
            })}
          </svg>
          <div className="adv-graph-legend">
            <span>▲ Sente Unggul</span>
            <span>Klik grafik untuk lompat ke langkah</span>
            <span>△ Gote Unggul</span>
          </div>
        </div>
      </section>

      {/* 4. Rincian 9 Jenis Tindakan */}
      <section className="review-section">
        <div className="review-skill-header">
          <span>Jenis Tindakan</span>
          <span className="counts-head-cols mono">
            <span>▲</span>
            <span>△</span>
          </span>
        </div>

        <div className="move-types-table">
          {REVIEW_CATEGORIES.map((cat) => {
            const sCount = review.senteCounts[cat.id];
            const gCount = review.goteCounts[cat.id];
            return (
              <div key={cat.id} className="move-type-row">
                <span
                  className="move-type-badge"
                  style={{
                    color: cat.color,
                    borderColor: `${cat.color}44`,
                    backgroundColor: `${cat.color}1A`,
                  }}
                >
                  {cat.symbol}
                </span>
                <span className="move-type-label">{cat.label}</span>
                <span className="move-type-num mono">{sCount}</span>
                <span className="move-type-num mono">{gCount}</span>
              </div>
            );
          })}
        </div>
      </section>

      {onRematch && (
        <div className="review-footer-actions">
          <button
            type="button"
            className="primary-solid-btn"
            style={{ width: '100%' }}
            onClick={onRematch}
          >
            <RotateCcw size={14} />
            <span>Main Lagi (Rematch)</span>
          </button>
        </div>
      )}
    </div>
  );
};
