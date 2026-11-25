/// <reference types="vite/client" />

// Google Identity Services (GIS) client helper for real Google Sign-In
// (Google One Tap notification + OAuth2 Account Chooser popup).

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
}

interface GisCredentialResponse {
  credential: string;
}

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisErrorResponse {
  type?: string;
  message?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (res: GisCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: () => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (res: GisTokenResponse) => void;
            error_callback?: (err: GisErrorResponse) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID_KEY = 'shogi_google_client_id_v1';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export function getConfiguredGoogleClientId(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem(GOOGLE_CLIENT_ID_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveConfiguredGoogleClientId(clientId: string): void {
  try {
    const cleaned = clientId.trim();
    if (cleaned) {
      localStorage.setItem(GOOGLE_CLIENT_ID_KEY, cleaned);
    } else {
      localStorage.removeItem(GOOGLE_CLIENT_ID_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function isValidGoogleClientId(clientId: string): boolean {
  const clean = clientId.trim();
  return clean.length > 20 && clean.endsWith('.apps.googleusercontent.com');
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as Record<string, unknown>;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2 && window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');

    let settled = false;
    const done = (ok: boolean, err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      if (ok) resolve();
      else reject(err ?? new Error('Gagal memuat Google Identity Services.'));
    };

    const poll = window.setInterval(() => {
      if (window.google?.accounts?.oauth2 && window.google?.accounts?.id) {
        done(true);
      }
    }, 80);

    const timeout = window.setTimeout(() => {
      done(
        false,
        new Error(
          'Timeout memuat script Google Sign-In. Pastikan koneksi internet aktif dan tidak diblokir ad-blocker.',
        ),
      );
    }, 8000);

    if (!existing) {
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () =>
        done(
          false,
          new Error(
            'Script Google Identity (accounts.google.com/gsi/client) gagal dimuat.',
          ),
        );
      document.head.appendChild(script);
    }
  });
}

export async function initGoogleOneTap(
  clientId: string,
  onSuccess: (user: GoogleUserProfile) => void,
): Promise<() => void> {
  let cancelled = false;
  try {
    await loadGoogleIdentityScript();
    if (cancelled || !window.google?.accounts?.id) return () => {};

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      callback: (res) => {
        if (cancelled || !res.credential) return;
        try {
          const payload = decodeJwtPayload(res.credential);
          const email = typeof payload.email === 'string' ? payload.email : '';
          const name =
            typeof payload.name === 'string'
              ? payload.name
              : email.split('@')[0] || 'ShogiPlayer';
          const picture =
            typeof payload.picture === 'string' ? payload.picture : undefined;
          if (email) {
            onSuccess({ email, name, picture });
          }
        } catch {
          // ignore malformed credential
        }
      },
    });

    window.google.accounts.id.prompt();
  } catch {
    // One Tap is opportunistic; manual button remains available.
  }

  return () => {
    cancelled = true;
    try {
      window.google?.accounts?.id?.cancel();
    } catch {
      // ignore cancel errors
    }
  };
}

export async function triggerGoogleAccountChooser(
  clientId: string,
): Promise<GoogleUserProfile> {
  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google OAuth2 client belum tersedia di browser.');
  }

  return new Promise<GoogleUserProfile>((resolve, reject) => {
    let finished = false;
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: async (tokenResp) => {
        if (finished) return;
        finished = true;
        if (tokenResp.error || !tokenResp.access_token) {
          reject(
            new Error(
              tokenResp.error_description ||
                tokenResp.error ||
                'Login Google dibatalkan.',
            ),
          );
          return;
        }
        try {
          const userRes = await fetch(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
              headers: {
                Authorization: `Bearer ${tokenResp.access_token}`,
              },
            },
          );
          if (!userRes.ok) {
            throw new Error(`HTTP ${userRes.status}`);
          }
          const info = (await userRes.json()) as {
            email?: string;
            name?: string;
            picture?: string;
          };
          if (!info.email) {
            throw new Error('Email Google tidak ditemukan dari profil.');
          }
          resolve({
            email: info.email,
            name: info.name || info.email.split('@')[0] || 'ShogiPlayer',
            picture: info.picture,
          });
        } catch (err) {
          reject(
            err instanceof Error
              ? err
              : new Error('Gagal mengambil profil akun Google.'),
          );
        }
      },
      error_callback: (err) => {
        if (finished) return;
        finished = true;
        if (err.type === 'popup_closed') {
          reject(new Error('Popup pilih akun Google ditutup sebelum selesai.'));
        } else if (err.type === 'popup_failed_to_open') {
          reject(
            new Error(
              'Popup Google diblokir oleh browser. Izinkan pop-up untuk localhost lalu coba lagi.',
            ),
          );
        } else {
          reject(
            new Error(err.message || 'Gagal membuka popup akun Google.'),
          );
        }
      },
    });

    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

export function disableGoogleAutoSelect(): void {
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    // ignore
  }
}
