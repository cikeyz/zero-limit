import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY_OPENCODE_GO } from '@/constants/storage';
import { secureStorage } from '@/services/storage/secureStorage';

interface OpenCodeGoState {
  apiKey: string;
  workspaceId: string;
  authCookie: string;
  setApiKey: (apiKey: string) => void;
  setCredentials: (workspaceId: string, authCookie: string) => void;
  clearCredentials: () => void;
}

export const useOpenCodeGoStore = create<OpenCodeGoState>()(
  persist(
    (set) => ({
      apiKey: '',
      workspaceId: '',
      authCookie: '',

      setApiKey: (apiKey) => set({ apiKey }),
      setCredentials: (workspaceId, authCookie) => set({ workspaceId, authCookie }),
      clearCredentials: () => set({ apiKey: '', workspaceId: '', authCookie: '' }),
    }),
    {
      name: STORAGE_KEY_OPENCODE_GO,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<OpenCodeGoState>(name);
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
        apiKey: state.apiKey,
        workspaceId: state.workspaceId,
        authCookie: state.authCookie,
      }),
    }
  )
);

export function notifyAccountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zero-limit:accounts-changed'));
  }
}
