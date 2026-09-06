import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_COMMANDCODE = 'commandcode-credentials';

export interface CommandCodeAccount {
  id: string;
  label: string;
  apiKey: string;
}

interface CommandCodeState {
  accounts: CommandCodeAccount[];
  addAccount: (account: Omit<CommandCodeAccount, 'id'> & { id?: string }) => CommandCodeAccount;
  removeAccount: (id: string) => void;
  setAccountLabel: (id: string, label: string) => void;
  updateAccount: (id: string, patch: Partial<Omit<CommandCodeAccount, 'id'>>) => void;
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
  accounts?: CommandCodeAccount[];
  apiKey?: unknown;
  label?: unknown;
};

function migratePersisted(persisted: unknown): { accounts: CommandCodeAccount[] } {
  const p = (persisted || {}) as LegacyPersisted;
  if (Array.isArray(p.accounts) && p.accounts.length > 0) {
    return {
      accounts: p.accounts.filter((a) => a && typeof a.id === 'string'),
    };
  }
  const apiKey = typeof p.apiKey === 'string' ? p.apiKey : '';
  const label = typeof p.label === 'string' ? p.label : '';
  if (apiKey) {
    return {
      accounts: [{ id: newAccountId(), label, apiKey }],
    };
  }
  return { accounts: [] };
}

export const useCommandCodeStore = create<CommandCodeState>()(
  persist(
    (set) => ({
      accounts: [],

      addAccount: (account) => {
        const next: CommandCodeAccount = {
          id: account.id || newAccountId(),
          label: account.label || '',
          apiKey: account.apiKey || '',
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
      name: STORAGE_KEY_COMMANDCODE,
      version: 1,
      migrate: (persisted) => migratePersisted(persisted) as CommandCodeState,
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
