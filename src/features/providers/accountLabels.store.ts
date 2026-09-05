import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_ACCOUNT_LABELS = 'account-labels';

/**
 * Stable identity for one auth file across the Providers and Quota pages:
 * the filename alone (unique per auth file). Provider strings differ
 * between API shapes, so they must not be part of the key.
 */
export function accountLabelKey(filename: string | undefined, id?: string): string | null {
  const f = (filename || id || '').trim();
  if (!f) return null;
  return f;
}

interface AccountLabelsState {
  labels: Record<string, string>;
  setLabel: (key: string, label: string) => void;
  clearLabel: (key: string) => void;
}

export const useAccountLabelsStore = create<AccountLabelsState>()(
  persist(
    (set) => ({
      labels: {},

      setLabel: (key, label) => set((state) => ({
        labels: { ...state.labels, [key]: label },
      })),
      clearLabel: (key) => set((state) => {
        const next = { ...state.labels };
        delete next[key];
        return { labels: next };
      }),
    }),
    {
      name: STORAGE_KEY_ACCOUNT_LABELS,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<AccountLabelsState>(name);
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
        labels: state.labels,
      }),
    }
  )
);
