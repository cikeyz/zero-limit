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

export const ANTIGRAVITY_GROUPS = [
  { id: 'claude-gpt', label: 'Claude models', identifiers: ['claude-sonnet-4-6', 'claude-opus-4-6-thinking', 'gpt-oss-120b-medium'] },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', identifiers: ['gemini-3.1-pro-high', 'gemini-3.1-pro-low', 'gemini-pro-agent'] },
  { id: 'gemini-3-5-flash', label: 'Gemini 3.5 Flash', identifiers: ['gemini-3.5-flash-low', 'gemini-3.5-flash-extra-low', 'gemini-3-flash-agent'] },
  { id: 'gemini-3-6-flash', label: 'Gemini 3.6 Flash', identifiers: ['gemini-3.6-flash-low', 'gemini-3.6-flash-medium', 'gemini-3.6-flash-high', 'gemini-3.6-flash-tiered', 'gemini-3.7-flash-tiered'] },
  { id: 'gemini-3-1-flash-lite', label: 'Gemini 3.1 Flash Lite', identifiers: ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-thinking'] },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', identifiers: ['gemini-3-flash'] },
  { id: 'gemini-2-5-pro', label: 'Gemini 2.5 Pro', identifiers: ['gemini-2.5-pro'] },
  { id: 'gemini-image', label: 'Gemini Image', identifiers: ['gemini-3.1-flash-image'] }
];
