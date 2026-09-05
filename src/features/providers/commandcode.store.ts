import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '@/services/storage/secureStorage';

const STORAGE_KEY_COMMANDCODE = 'commandcode-credentials';

interface CommandCodeState {
  apiKey: string;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
}

export const useCommandCodeStore = create<CommandCodeState>()(
  persist(
    (set) => ({
      apiKey: '',

      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    {
      name: STORAGE_KEY_COMMANDCODE,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          const data = secureStorage.getItem<CommandCodeState>(name);
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
