import React from 'react';

interface ShogiKomaIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Monochrome line-art Shogi Koma icon matching the Slate Board Studio icon style.
 */
export const ShogiKomaIcon: React.FC<ShogiKomaIconProps> = ({
  size = 20,
  strokeWidth = 1.6,
  className,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Pentagon Shogi piece outline */}
      <polygon points="12,2.2 19,6.4 20.6,21.2 3.4,21.2 5,6.4" />
      {/* Clean stylized King (王) kanji strokes inside */}
      <line x1="8.6" y1="9.2" x2="15.4" y2="9.2" />
      <line x1="9.2" y1="13.2" x2="14.8" y2="13.2" />
      <line x1="7.8" y1="17.2" x2="16.2" y2="17.2" />
      <line x1="12" y1="9.2" x2="12" y2="17.2" />
    </svg>
  );
};
