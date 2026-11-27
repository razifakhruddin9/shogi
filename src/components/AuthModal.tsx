import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  getConfiguredGoogleClientId,
  GoogleUserProfile,
  initGoogleOneTap,
  isValidGoogleClientId,
  saveConfiguredGoogleClientId,
  triggerGoogleAccountChooser,
} from '../engine/googleAuth';
import { useI18n } from '../i18n';
import { LanguagePicker } from './LanguagePicker';
import { PlayerProfile } from './ShellChrome';

interface StoredAccount {
  email: string;
  password: string;
  username: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  elo: number;
  targetElo: number;
  preferredSide: 'b' | 'w' | 'random';
  defaultTimeControl: string;
}

const ACCOUNTS_KEY = 'shogi_studio_accounts_v1';

function loadStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function saveStoredAccount(acc: StoredAccount) {
  const list = loadStoredAccounts().filter(
    (a) => a.email.toLowerCase() !== acc.email.toLowerCase(),
  );
  list.unshift(acc);
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // ignore storage quota errors
  }
}

interface AuthModalProps {
  profile: PlayerProfile;
  isEntryGate?: boolean;
  onClose: () => void;
  onSave: (next: PlayerProfile) => void;
  onLogout: () => void;
  onContinueAsGuest?: () => void;
}

const GoogleGIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  profile,
  isEntryGate = false,
  onClose,
  onSave,
  onLogout,
  onContinueAsGuest,
}) => {
  const { t } = useI18n();
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(() =>
    getConfiguredGoogleClientId(),
  );
  const [clientIdDraft, setClientIdDraft] = useState(() =>
    getConfiguredGoogleClientId(),
  );
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const [email, setEmail] = useState(profile.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState(profile.username);
  const [targetElo, setTargetElo] = useState(profile.targetElo);
  const [preferredSide, setPreferredSide] = useState<'b' | 'w' | 'random'>(
    profile.preferredSide,
  );
  const [defaultTimeControl, setDefaultTimeControl] = useState(
    profile.defaultTimeControl,
  );
  const [error, setError] = useState('');

  const completeGoogleLogin = useCallback(
    (user: GoogleUserProfile) => {
      const cleanEmail = user.email.trim().toLowerCase();
      const existing = loadStoredAccounts().find(
        (a) => a.email.toLowerCase() === cleanEmail,
      );
      const nextAcc: StoredAccount = {
        email: cleanEmail,
        password: existing?.password ?? '',
        username: user.name || existing?.username || cleanEmail.split('@')[0],
        avatarUrl: user.picture ?? existing?.avatarUrl,
        provider: 'google',
        elo: existing?.elo ?? profile.elo,
        targetElo: existing?.targetElo ?? profile.targetElo,
        preferredSide: existing?.preferredSide ?? profile.preferredSide,
        defaultTimeControl:
          existing?.defaultTimeControl ?? profile.defaultTimeControl,
      };
      saveStoredAccount(nextAcc);
      onSave({
        ...profile,
        username: nextAcc.username,
        email: nextAcc.email,
        avatarUrl: nextAcc.avatarUrl,
        authProvider: 'google',
        elo: nextAcc.elo,
        targetElo: nextAcc.targetElo,
        preferredSide: nextAcc.preferredSide,
        defaultTimeControl: nextAcc.defaultTimeControl,
        loggedIn: true,
      });
      onClose();
    },
    [onClose, onSave, profile],
  );

  // Trigger native Google One Tap ("notif pilih akun Google") automatically when configured
  useEffect(() => {
    if (profile.loggedIn && !isEntryGate) return;
    if (!isValidGoogleClientId(googleClientId)) return;

    let cancelOneTap = () => {};
    void initGoogleOneTap(googleClientId, completeGoogleLogin).then((cancel) => {
      cancelOneTap = cancel;
    });
    return () => {
      cancelOneTap();
    };
  }, [completeGoogleLogin, googleClientId, isEntryGate, profile.loggedIn]);

  const launchRealGooglePopup = async (activeClientId: string) => {
    setGoogleError('');
    setError('');
    setGoogleBusy(true);
    try {
      const user = await triggerGoogleAccountChooser(activeClientId);
      completeGoogleLogin(user);
    } catch (err) {
      setGoogleError(
        err instanceof Error
          ? err.message
          : 'Gagal membuka popup akun Google.',
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleButtonClick = () => {
    setGoogleError('');
    setError('');
    if (!isValidGoogleClientId(googleClientId)) {
      setClientIdDraft(googleClientId);
      setShowGoogleSetup(true);
      return;
    }
    void launchRealGooglePopup(googleClientId);
  };

  const handleSaveGoogleClientId = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = clientIdDraft.trim();
    if (!isValidGoogleClientId(cleaned)) {
      setError(
        'Masukkan Google OAuth Client ID yang valid (berakhiran .apps.googleusercontent.com).',
      );
      return;
    }
    saveConfiguredGoogleClientId(cleaned);
    setGoogleClientId(cleaned);
    setShowGoogleSetup(false);
    void launchRealGooglePopup(cleaned);
  };

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    const accounts = loadStoredAccounts();
    if (authTab === 'signin') {
      const found = accounts.find(
        (a) => a.email.toLowerCase() === cleanEmail && a.provider === 'email',
      );
      if (!found) {
        setError(
          'Email belum terdaftar. Silakan pindah ke tab "Daftar Email" untuk membuat akun baru.',
        );
        return;
      }
      if (found.password !== password) {
        setError('Kata sandi salah. Silakan periksa kembali.');
        return;
      }
      onSave({
        ...profile,
        username: found.username,
        email: found.email,
        authProvider: 'email',
        elo: found.elo,
        targetElo: found.targetElo,
        preferredSide: found.preferredSide,
        defaultTimeControl: found.defaultTimeControl,
        loggedIn: true,
      });
      onClose();
      return;
    }

    // Register new email account
    const handle = username.trim() || cleanEmail.split('@')[0] || 'Sente_Player';
    const newAcc: StoredAccount = {
      email: cleanEmail,
      password,
      username: handle,
      provider: 'email',
      elo: profile.elo,
      targetElo,
      preferredSide,
      defaultTimeControl,
    };
    saveStoredAccount(newAcc);
    onSave({
      ...profile,
      username: handle,
      email: cleanEmail,
      authProvider: 'email',
      targetElo,
      preferredSide,
      defaultTimeControl,
      loggedIn: true,
    });
    onClose();
  };

  const handleSaveProfileSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedName = username.trim() || profile.username;
    if (profile.email) {
      const existing = loadStoredAccounts().find(
        (a) => a.email.toLowerCase() === profile.email!.toLowerCase(),
      );
      if (existing) {
        saveStoredAccount({
          ...existing,
          username: updatedName,
          targetElo,
          preferredSide,
          defaultTimeControl,
        });
      }
    }
    onSave({
      ...profile,
      username: updatedName,
      targetElo,
      preferredSide,
      defaultTimeControl,
      loggedIn: true,
    });
    onClose();
  };

  // Logged-in Profile Calibration View
  if (profile.loggedIn && !isEntryGate) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="studio-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{t('auth.profileTitle')}</h3>
            <button type="button" className="icon-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleSaveProfileSettings}>
            <div className="modal-body">
              <div className="auth-signed-banner">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    className="auth-signed-avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <ShieldCheck size={17} className="win-text" />
                )}
                <div>
                  <div className="auth-signed-name">{profile.username}</div>
                  <div className="auth-signed-meta">
                    {profile.authProvider === 'google'
                      ? `Akun Google • ${profile.email}`
                      : `Akun Email • ${profile.email ?? 'Lokal'}`}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Pemain (Handle)</label>
                <input
                  type="text"
                  className="studio-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Target Kalibrasi Elo: <strong className="mono">{targetElo}</strong>
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
                <label className="form-label">Kontrol Waktu Default</label>
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
                <label className="form-label">Sisi Favorit</label>
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
              <button
                type="button"
                className="secondary-btn danger-outline"
                onClick={onLogout}
              >
                <LogOut size={13} />
                <span>{t('auth.logout')}</span>
              </button>
              <button type="button" className="secondary-btn" onClick={onClose}>
                {t('auth.close')}
              </button>
              <button type="submit" className="primary-solid-btn">
                {t('auth.saveProfile')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Entry Login / Registration Page or Modal (Google or Email)
  const cardContent = (
    <div
      className={`studio-modal auth-entry-modal ${isEntryGate ? 'is-fullpage-card' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="modal-header">
        <div className="auth-brand-row">
          <img
            src="/shogi-logo.png?v=3"
            alt="Shogi Studio"
            className={isEntryGate ? 'home-logo-img' : 'shell-logo-img'}
          />
          <div>
            <h3>{isEntryGate ? 'Shogi Studio' : t('auth.modalTitle')}</h3>
            {isEntryGate && (
              <div className="auth-entry-subtitle">
                Slate Board Game Studio • 9×9 Japanese Chess
              </div>
            )}
          </div>
        </div>
        {!isEntryGate && (
          <button type="button" className="icon-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

        <div className="modal-body">
          {showGoogleSetup ? (
            <div className="google-panel-view">
              <div className="google-panel-header">
                <button
                  type="button"
                  className="auth-back-btn"
                  onClick={() => {
                    setShowGoogleSetup(false);
                    setError('');
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Kembali</span>
                </button>
                <div className="google-panel-badge">
                  <GoogleGIcon />
                  <span>Hubungkan Google OAuth</span>
                </div>
              </div>

              <div className="google-setup-card">
                <div className="google-setup-title">
                  Aktifkan Notif &amp; Pilihan Akun Google Asli
                </div>
                <p className="auth-welcome-sub">
                  Untuk memunculkan jendela resmi <strong>Pilih Akun Google</strong> dan
                  notifikasi Google One Tap, Google mewajibkan{' '}
                  <strong>OAuth Web Client ID</strong> yang terdaftar untuk alamat{' '}
                  <code>{window.location.origin}</code>:
                </p>
                <ol className="google-setup-steps">
                  <li>
                    Buka{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="google-setup-link"
                    >
                      Google Cloud Console <ExternalLink size={11} />
                    </a>{' '}
                    → <strong>Create Credentials</strong> → <strong>OAuth client ID</strong>{' '}
                    (Web application).
                  </li>
                  <li>
                    Di bagian <strong>Authorized JavaScript origins</strong>, tambahkan{' '}
                    <code>http://localhost:5173</code> dan <code>http://localhost</code>.
                  </li>
                  <li>
                    Tempel <strong>Client ID</strong> (<code>...apps.googleusercontent.com</code>)
                    di bawah (atau simpan di <code>.env</code> sebagai{' '}
                    <code>VITE_GOOGLE_CLIENT_ID</code>).
                  </li>
                </ol>
              </div>

              <form className="google-quick-box" onSubmit={handleSaveGoogleClientId}>
                <div className="form-group">
                  <label className="form-label">Google OAuth Client ID</label>
                  <input
                    type="text"
                    autoFocus
                    className="studio-input mono"
                    value={clientIdDraft}
                    onChange={(e) => {
                      setClientIdDraft(e.target.value);
                      setError('');
                    }}
                    placeholder="1234567890-xxxxx.apps.googleusercontent.com"
                  />
                </div>
                {error && <div className="form-error">{error}</div>}
                <button
                  type="submit"
                  className="primary-solid-btn"
                  disabled={googleBusy}
                  style={{ width: '100%' }}
                >
                  <GoogleGIcon />
                  <span>Simpan &amp; Buka Pilihan Akun Google</span>
                </button>
              </form>
            </div>
          ) : (
            <>
              <p className="auth-welcome-sub">{t('auth.welcome')}</p>

              {/* Real Google Sign-In OAuth Account Chooser Trigger */}
              <div className="google-cta-group">
                <button
                  type="button"
                  className="google-auth-btn"
                  disabled={googleBusy}
                  onClick={handleGoogleButtonClick}
                >
                  <GoogleGIcon />
                  <span>
                    {googleBusy
                      ? t('auth.googleOpening')
                      : t('auth.googleContinue')}
                  </span>
                </button>
                <div className="google-client-row">
                  <span className="google-status-text">
                    {isValidGoogleClientId(googleClientId)
                      ? t('auth.googleActiveNote')
                      : t('auth.googleNeedClientNote')}
                  </span>
                  <button
                    type="button"
                    className="google-config-link"
                    onClick={() => {
                      setClientIdDraft(googleClientId);
                      setError('');
                      setGoogleError('');
                      setShowGoogleSetup(true);
                    }}
                  >
                    <Settings size={11} />
                    <span>
                      {isValidGoogleClientId(googleClientId)
                        ? t('auth.googleChangeClient')
                        : t('auth.googleSetClient')}
                    </span>
                  </button>
                </div>
                {googleError && <div className="form-error">{googleError}</div>}
              </div>

              <div className="auth-divider">
                <span>{t('auth.orEmail')}</span>
              </div>

              {/* Email Sign-In / Register Tabs */}
              <div className="segmented-control">
                <button
                  type="button"
                  className={authTab === 'signin' ? 'active' : ''}
                  onClick={() => {
                    setAuthTab('signin');
                    setError('');
                  }}
                >
                  {t('auth.signInEmail')}
                </button>
                <button
                  type="button"
                  className={authTab === 'register' ? 'active' : ''}
                  onClick={() => {
                    setAuthTab('register');
                    setError('');
                  }}
                >
                  {t('auth.registerEmail')}
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="email-auth-form">
                {authTab === 'register' && (
                  <div className="form-group">
                    <label className="form-label">{t('auth.handle')}</label>
                    <input
                      type="text"
                      className="studio-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="contoh: Razi_Shogi"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">{t('auth.email')}</label>
                  <input
                    type="email"
                    className="studio-input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="email@domain.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{t('auth.password')}</label>
                  <div className="password-input-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="studio-input"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder={t('auth.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      className="pw-toggle-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {authTab === 'register' && (
                  <div className="form-group">
                    <label className="form-label">
                      {t('auth.targetElo')}: <strong className="mono">{targetElo}</strong>
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
                )}

                {error && <div className="form-error">{error}</div>}

                <button
                  type="submit"
                  className="primary-solid-btn"
                  style={{ width: '100%' }}
                >
                  <Mail size={14} />
                  <span>
                    {authTab === 'signin' ? t('auth.signInBtn') : t('auth.registerBtn')}
                  </span>
                </button>
              </form>
            </>
          )}
        </div>

        <div className="modal-footer auth-entry-footer">
          {onContinueAsGuest && (
            <button
              type="button"
              className="ghost-btn-sm"
              onClick={onContinueAsGuest}
            >
              {t('auth.guestBtn')}
            </button>
          )}
          {!isEntryGate && (
            <button type="button" className="secondary-btn" onClick={onClose}>
              {t('auth.cancel')}
            </button>
          )}
        </div>
      </div>
  );

  if (isEntryGate) {
    return (
      <div className="auth-fullpage-shell">
        <header className="shell-titlebar">
          <div className="shell-titlebar-left">
            <img
              src="/shogi-logo.png?v=3"
              alt="Shogi Studio Logo"
              className="shell-logo-img"
            />
            <span className="shell-app-name">Shogi Studio</span>
          </div>
          <div className="shell-titlebar-right">
            <LanguagePicker compact={false} />
          </div>
        </header>
        <main className="auth-fullpage-canvas">{cardContent}</main>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      {cardContent}
    </div>
  );
};
