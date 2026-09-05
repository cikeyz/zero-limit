import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY_OPENCODE_GO } from '@/constants/storage';
import { secureStorage } from '@/services/storage/secureStorage';

interface OpenCodeGoState {
  apiKey: string;
  workspaceId: string;
  authCookie: string;
  label: string;
  setApiKey: (apiKey: string) => void;
  setCredentials: (workspaceId: string, authCookie: string) => void;
  setLabel: (label: string) => void;
  clearCredentials: () => void;
}

export const useOpenCodeGoStore = create<OpenCodeGoState>()(
  persist(
    (set) => ({
      apiKey: '',
      workspaceId: '',
      authCookie: '',
      label: '',

      setApiKey: (apiKey) => set({ apiKey }),
      setCredentials: (workspaceId, authCookie) => set({ workspaceId, authCookie }),
      setLabel: (label) => set({ label }),
      clearCredentials: () => set({ apiKey: '', workspaceId: '', authCookie: '', label: '' }),
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
        label: state.label,
      }),
    }
  )
);

export function notifyAccountsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zero-limit:accounts-changed'));
  }
}
