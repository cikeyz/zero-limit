import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_XAI = 'xai-credentials';

interface XaiState {
  apiKey: string;
  cliKey: string;
  cliRefresh: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
  setCliSession: (key: string, refresh: string) => void;
  clearCliSession: () => void;
}

export const useXaiStore = create<XaiState>()(
  persist(
    (set) => ({
      apiKey: '',
      cliKey: '',
      cliRefresh: '',

      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: '' }),
      setCliSession: (key, refresh) => set({ cliKey: key, cliRefresh: refresh }),
      clearCliSession: () => set({ cliKey: '', cliRefresh: '' }),
    }),
    {
      name: STORAGE_KEY_XAI,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<XaiState>(name);
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
        cliKey: state.cliKey,
        cliRefresh: state.cliRefresh,
      }),
    }
  )
);
