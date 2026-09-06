import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY_OPENCODE_GO } from '@/constants/storage';
import { secureStorage } from '@/services/storage/secureStorage';

export interface OpenCodeGoAccount {
  id: string;
  label: string;
  apiKey: string;
  workspaceId: string;
  authCookie: string;
}

interface OpenCodeGoState {
  accounts: OpenCodeGoAccount[];
  addAccount: (account: Omit<OpenCodeGoAccount, 'id'> & { id?: string }) => OpenCodeGoAccount;
  removeAccount: (id: string) => void;
  setAccountLabel: (id: string, label: string) => void;
  updateAccount: (id: string, patch: Partial<Omit<OpenCodeGoAccount, 'id'>>) => void;
  clearAccounts: () => void;
}

export function newTrackerAccountId(): string {
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
  accounts?: OpenCodeGoAccount[];
  apiKey?: unknown;
  workspaceId?: unknown;
  authCookie?: unknown;
  label?: unknown;
};

function migratePersisted(persisted: unknown): { accounts: OpenCodeGoAccount[] } {
  const p = (persisted || {}) as LegacyPersisted;
  if (Array.isArray(p.accounts) && p.accounts.length > 0) {
    return {
      accounts: p.accounts.filter((a) => a && typeof a.id === 'string'),
    };
  }
  const apiKey = typeof p.apiKey === 'string' ? p.apiKey : '';
  const workspaceId = typeof p.workspaceId === 'string' ? p.workspaceId : '';
  const authCookie = typeof p.authCookie === 'string' ? p.authCookie : '';
  const label = typeof p.label === 'string' ? p.label : '';
  if (apiKey || (workspaceId && authCookie)) {
    return {
      accounts: [{ id: newTrackerAccountId(), label, apiKey, workspaceId, authCookie }],
    };
  }
  return { accounts: [] };
}

export const useOpenCodeGoStore = create<OpenCodeGoState>()(
  persist(
    (set) => ({
      accounts: [],

      addAccount: (account) => {
        const next: OpenCodeGoAccount = {
          id: account.id || newTrackerAccountId(),
          label: account.label || '',
          apiKey: account.apiKey || '',
          workspaceId: account.workspaceId || '',
          authCookie: account.authCookie || '',
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
      name: STORAGE_KEY_OPENCODE_GO,
      version: 1,
      migrate: (persisted) => migratePersisted(persisted) as OpenCodeGoState,
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

export function notifyAccountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zero-limit:accounts-changed'));
  }
}
