import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_XAI = 'xai-credentials';

interface XaiState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
}

export const useXaiStore = create<XaiState>()(
  persist(
    (set) => ({
      apiKey: '',

      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: '' }),
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
      }),
    }
  )
);
