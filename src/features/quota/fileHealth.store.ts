import { create } from 'zustand';

export type FileHealthStatus = 'ok' | 'error' | 'unknown';

export interface FileHealth {
  status: FileHealthStatus;
  message?: string;
}

interface FileHealthState {
  map: Record<string, FileHealth>;
  setHealth: (fileId: string, health: FileHealth) => void;
  clear: () => void;
}

/**
 * Quota-check outcomes per auth file, shared with the Providers page
 * so account rows reflect live token state instead of always "Active".
 * In-memory only: unknown until a quota check runs.
 */
export const useFileHealthStore = create<FileHealthState>()((set) => ({
  map: {},

  setHealth: (fileId, health) =>
    set((state) => ({ map: { ...state.map, [fileId]: health } })),
  clear: () => set({ map: {} }),
}));

export function healthLabel(message: string | undefined): string {
  const msg = (message || '').toLowerCase();
  if (msg.includes('401') || msg.includes('expired') || msg.includes('invalid')) {
    return 'Expired';
  }
  return 'Error';
}
