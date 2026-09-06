import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_XAI = 'xai-credentials';

export interface XaiAccount {
  id: string;
  label: string;
  apiKey: string;
  cliKey: string;
  cliRefresh: string;
}

interface XaiState {
  accounts: XaiAccount[];
  addAccount: (account: Omit<XaiAccount, 'id'> & { id?: string }) => XaiAccount;
  removeAccount: (id: string) => void;
  setAccountLabel: (id: string, label: string) => void;
  updateAccount: (id: string, patch: Partial<Omit<XaiAccount, 'id'>>) => void;
  clearAccounts: () => void;
}

function newAccountId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).randomUUID === 'function') {
      return (crypto as Crypto).randomUUID();
    }
  } catch {
    // fall through to Date.now() fallback below
  }
  return String(Date.now());
}

type LegacyPersisted = {
  accounts?: XaiAccount[];
  apiKey?: unknown;
  cliKey?: unknown;
  cliRefresh?: unknown;
  label?: unknown;
};

function migratePersisted(persisted: unknown): { accounts: XaiAccount[] } {
  const p = (persisted || {}) as LegacyPersisted;
  if (Array.isArray(p.accounts) && p.accounts.length > 0) {
    return {
      accounts: p.accounts.filter((a) => a && typeof a.id === 'string'),
    };
  }
  const apiKey = typeof p.apiKey === 'string' ? p.apiKey : '';
  const cliKey = typeof p.cliKey === 'string' ? p.cliKey : '';
  const cliRefresh = typeof p.cliRefresh === 'string' ? p.cliRefresh : '';
  const label = typeof p.label === 'string' ? p.label : '';
  if (apiKey || cliKey) {
    return {
      accounts: [{ id: newAccountId(), label, apiKey, cliKey, cliRefresh }],
    };
  }
  return { accounts: [] };
}

export const useXaiStore = create<XaiState>()(
  persist(
    (set) => ({
      accounts: [],

      addAccount: (account) => {
        const next: XaiAccount = {
          id: account.id || newAccountId(),
          label: account.label || '',
          apiKey: account.apiKey || '',
          cliKey: account.cliKey || '',
          cliRefresh: account.cliRefresh || '',
        };
        set((state) => ({ accounts: [...state.accounts, next] }));
        return next;
      },
      removeAccount: (id) => set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) })),
      setAccountLabel: (id, label) =>
        set((state) => ({ accounts: state.accounts.map((a) => (a.id === id ? { ...a, label } : a)) })),
      updateAccount: (id, patch) =>
        set((state) => ({ accounts: state.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      clearAccounts: () => set({ accounts: [] }),
    }),
    {
      name: STORAGE_KEY_XAI,
      version: 1,
      migrate: (persisted) => migratePersisted(persisted) as XaiState,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<unknown>(name);
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
        accounts: state.accounts,
      }),
    }
  )
);
