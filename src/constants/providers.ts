import type { OAuthProvider } from '@/types';

export const PROVIDERS = [
  { id: 'antigravity', name: 'Antigravity', requiresProjectId: false },
  { id: 'anthropic', name: 'Claude', requiresProjectId: false },
  { id: 'codex', name: 'Codex', requiresProjectId: false },
  { id: 'cursor', name: 'Cursor', requiresProjectId: false },
  { id: 'copilot', name: 'GitHub Copilot', requiresProjectId: false },
  { id: 'kiro', name: 'Kiro', requiresProjectId: false },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

export const WEBUI_SUPPORTED: OAuthProvider[] = ['codex', 'anthropic', 'antigravity', 'kiro'];

export const PLUS_ONLY_PROVIDERS: ProviderId[] = ['copilot', 'kiro', 'cursor'];

export const CALLBACK_PROVIDER_MAP: Partial<Record<OAuthProvider, string>> = {
};

export const AUTH_URL_PROVIDER_MAP: Partial<Record<OAuthProvider, string>> = {
  'copilot': 'github'
};
