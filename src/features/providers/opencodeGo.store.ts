import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY_OPENCODE_GO } from '@/constants/storage';
import { secureStorage } from '@/services/storage/secureStorage';

interface OpenCodeGoState {
  workspaceId: string;
  authCookie: string;
  setCredentials: (workspaceId: string, authCookie: string) => void;
  clearCredentials: () => void;
}

export const useOpenCodeGoStore = create<OpenCodeGoState>()(
  persist(
    (set) => ({
      workspaceId: '',
      authCookie: '',

      setCredentials: (workspaceId, authCookie) => set({ workspaceId, authCookie }),
      clearCredentials: () => set({ workspaceId: '', authCookie: '' }),
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
        workspaceId: state.workspaceId,
        authCookie: state.authCookie,
      }),
    }
  )
);
