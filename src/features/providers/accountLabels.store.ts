import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_ACCOUNT_LABELS = 'account-labels';

export function accountLabelKey(provider: string | undefined, filename: string | undefined): string | null {
  const p = (provider || '').trim().toLowerCase();
  const f = (filename || '').trim();
  if (!p || !f) return null;
  return `${p}::${f}`;
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
