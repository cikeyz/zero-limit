import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';
import { fileWorstUsed, accountLabel } from '@/shared/utils/quota.helpers';
import type { FileQuota, ProviderSection } from '@/types';

const STORAGE_KEY = 'quota-history';
/** Minimum gap between snapshots unless values moved. */
const MIN_INTERVAL_MS = 30 * 60 * 1000;
/** Change (percentage points) that forces a snapshot inside the interval. */
const CHANGE_EPS = 0.5;
/** Hard cap on stored snapshots (oldest pruned first). */
const MAX_SNAPSHOTS = 2000;

export interface HistoryAccount {
  fileId: string;
  provider: string;
  displayName: string;
  label: string;
  worst: number | null;
}

export interface QuotaSnapshot {
  t: number;
  accounts: HistoryAccount[];
}

function snapshotKey(s: QuotaSnapshot): string {
  return s.accounts
    .map((a) => `${a.fileId}:${a.worst === null ? 'x' : a.worst.toFixed(1)}`)
    .sort()
    .join('|');
}

interface HistoryState {
  snapshots: QuotaSnapshot[];
  recordSnapshot: (sections: ProviderSection[]) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      snapshots: [],

      recordSnapshot: (sections) => {
        // Only record settled snapshots that carry at least one real reading.
        let settled = true;
        let hasData = false;
        for (const s of sections) {
          for (const f of s.files) {
            if (f.loading) {
              settled = false;
              break;
            }
            if (!f.error && ((f.models && f.models.length > 0) || (f.limits && f.limits.length > 0))) {
              hasData = true;
            }
          }
          if (!settled) break;
        }
        if (!settled || !hasData) return;

        const now = Date.now();
        const accounts: HistoryAccount[] = [];
        for (const s of sections) {
          for (const f of s.files) {
            if (f.loading || f.error) continue;
            const worst = fileWorstUsed(f);
            if (worst === null) continue;
            accounts.push({
              fileId: f.fileId,
              provider: s.provider,
              displayName: s.displayName,
              label: accountLabel(f),
              worst,
            });
          }
        }
        if (accounts.length === 0) return;

        const next: QuotaSnapshot = { t: now, accounts };
        const prev = get().snapshots;
        const last = prev[prev.length - 1];
        if (last) {
          const sameValues = snapshotKey(last) === snapshotKey(next);
          if (sameValues || now - last.t < MIN_INTERVAL_MS) {
            // Inside the interval only a real movement earns a snapshot.
            if (sameValues) return;
            if (now - last.t < MIN_INTERVAL_MS) {
              let moved = false;
              const prevMap = new Map(last.accounts.map((a) => [a.fileId, a.worst]));
              for (const a of accounts) {
                const p = prevMap.get(a.fileId);
                if (p === undefined || p === null || Math.abs(p - (a.worst ?? 0)) >= CHANGE_EPS) {
                  moved = true;
                  break;
                }
              }
              if (!moved) return;
            }
          }
        }

        const snapshots = [...prev, next];
        while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
        set({ snapshots });
      },

      clearHistory: () => set({ snapshots: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<HistoryState>(name);
          return data ? JSON.stringify(data) : null;
        },
        setItem: (name, value) => {
          secureStorage.setItem(name, JSON.parse(value));
        },
        removeItem: (name) => {
          secureStorage.removeItem(name);
        },
      })),
      partialize: (state) => ({
        snapshots: state.snapshots,
      }),
    }
  )
);
