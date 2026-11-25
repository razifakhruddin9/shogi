import { ParsedDatabaseGame } from './kifuParser';

const DB_NAME = 'ShogiStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'games';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadGamesFromDeviceDb(): Promise<ParsedDatabaseGame[] | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as (ParsedDatabaseGame & { _order?: number })[]) ?? [];
        rows.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveGamesToDeviceDb(games: ParsedDatabaseGame[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      games.forEach((g, idx) => {
        store.put({ ...g, _order: idx });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback silently if IndexedDB unavailable
  }
}

/**
 * Triggers a browser download to the user's Downloads folder containing all games in multi-game CSA or SFEN format.
 */
export function downloadDatabaseToDevice(
  games: ParsedDatabaseGame[],
  filename = `shogi-database-${new Date().toISOString().slice(0, 10)}.csa`,
): void {
  const blocks: string[] = [];
  for (const g of games) {
    if (g.rawSource && g.format === 'csa') {
      blocks.push(g.rawSource.trim());
    } else {
      // Export as SFEN + USI line fallback or CSA header + moves
      blocks.push(
        `' ${g.title}\nN+${g.senteName}\nN-${g.goteName}\n' SFEN: ${g.initialSfen}\n' USI: ${g.movesUsi.join(' ')}`,
      );
    }
  }
  const content = blocks.join('\n/\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
