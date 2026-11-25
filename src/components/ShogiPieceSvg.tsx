import React from 'react';
import { isPromoted } from '../engine/sfen';
import { PIECE_KANJI, PIECE_SHORT_EN, PieceType, Side } from '../engine/types';

interface ShogiPieceSvgProps {
  type: PieceType;
  side: Side;
  flipped?: boolean;
  showEnglishHint?: boolean;
  isKingChallenging?: boolean;
  size?: 'board' | 'hand' | 'mini';
}

/**
 * Renders an authentic tapered pentagon Shogi Koma tile with sumi/crimson Kanji.
 */
export const ShogiPieceSvg: React.FC<ShogiPieceSvgProps> = ({
  type,
  side,
  flipped = false,
  showEnglishHint = false,
  isKingChallenging = false,
  size = 'board',
}) => {
  const promoted = isPromoted(type);
  const pointsDown = flipped ? side === 'b' : side === 'w';
  // Traditional Shogi: senior/Sente ('b') uses 王, Gote ('w') uses 玉
  const kanji =
    type === 'K' ? (isKingChallenging ? '玉' : side === 'b' ? '王' : '玉') : PIECE_KANJI[type];

  const inkColor = promoted ? '#C63327' : '#1B1917';
  const shortEn = PIECE_SHORT_EN[type];

  // Scale slightly smaller for weaker pieces (Pawn/Lance/Knight) for authentic Koma feel
  const scaleFactor =
    type === 'P' || type === '+P'
      ? 0.88
      : type === 'L' || type === '+L' || type === 'N' || type === '+N'
        ? 0.92
        : type === 'S' || type === '+S' || type === 'G'
          ? 0.96
          : 1;

  const fontSize =
    size === 'mini' ? 14 : size === 'hand' ? 20 : 25;

  return (
    <div
      className={`shogi-piece-wrap ${pointsDown ? 'is-opponent' : 'is-self'}`}
      style={{
        transform: `scale(${scaleFactor}) ${pointsDown ? 'rotate(180deg)' : ''}`,
      }}
    >
      <svg
        viewBox="0 0 100 110"
        className="shogi-koma-svg"
        aria-label={`${side === 'b' ? 'Sente' : 'Gote'} ${type}`}
      >
        <defs>
          <linearGradient id="komaWood" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F9E8C4" />
            <stop offset="65%" stopColor="#EED4A2" />
            <stop offset="100%" stopColor="#DFBC80" />
          </linearGradient>
        </defs>
        {/* Subtle drop shadow for wood thickness */}
        <polygon
          points="50,6 85,22 93,103 7,103 15,22"
          fill="#8E693D"
          transform="translate(0, 2.5)"
        />
        {/* Main beveled Koma pentagon */}
        <polygon
          points="50,5 85,21 93,101 7,101 15,21"
          fill="url(#komaWood)"
          stroke="#7A5A35"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Inner highlight edge */}
        <polygon
          points="50,9 81,23.5 88.5,97 11.5,97 19,23.5"
          fill="none"
          stroke="rgba(255,255,255,0.42)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Kanji glyph */}
        <text
          x="50"
          y={showEnglishHint ? '62' : '67'}
          textAnchor="middle"
          dominantBaseline="central"
          fill={inkColor}
          fontFamily="var(--font-kanji)"
          fontWeight="700"
          fontSize={fontSize * 1.9}
        >
          {kanji}
        </text>
        {showEnglishHint && (
          <text
            x="50"
            y="88"
            textAnchor="middle"
            fill={promoted ? '#A62B21' : '#5E4B35'}
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fontSize="15"
          >
            {shortEn}
          </text>
        )}
      </svg>
    </div>
  );
};
