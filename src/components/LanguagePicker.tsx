import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { SUPPORTED_LOCALES, useI18n } from '../i18n';

interface LanguagePickerProps {
  compact?: boolean;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  compact = true,
}) => {
  const { locale, localeMeta, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    return () => window.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div className="lang-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`lang-picker-trigger ${compact ? 'compact' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={`${localeMeta.nativeLabel} — ${localeMeta.country}`}
        aria-expanded={open}
      >
        <Globe size={13} />
        <span className="lang-code-pill mono">{localeMeta.shortCode}</span>
        {!compact && <span className="lang-full-name">{localeMeta.nativeLabel}</span>}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="lang-picker-menu" role="listbox" aria-label="Language Selector">
          {SUPPORTED_LOCALES.map((opt) => {
            const active = opt.code === locale;
            return (
              <button
                key={opt.code}
                type="button"
                role="option"
                aria-selected={active}
                className={`lang-picker-item ${active ? 'active' : ''}`}
                onClick={() => {
                  setLocale(opt.code);
                  setOpen(false);
                }}
              >
                <span className="lang-item-code mono">{opt.shortCode}</span>
                <span className="lang-item-labels">
                  <span className="lang-item-native">{opt.nativeLabel}</span>
                  <span className="lang-item-country">{opt.country}</span>
                </span>
                {active && <Check size={13} className="accent-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
