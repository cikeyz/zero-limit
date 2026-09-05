import type { AuthFile } from './authFile';

export interface QuotaModel {
  name: string;
  percentage: number;
  resetTime?: string;
  displayValue?: string;
  /** True when percentage means used (vs the default, remaining). */
  used?: boolean;
  /** True to render as its own trailing group instead of merging. */
  separate?: boolean;
  /** Lower values sort first (time-window order); missing sorts last. */
  sortOrder?: number;
}

export interface AntigravityQuotaResult {
  models: QuotaModel[];
  error?: string;
}

export interface ClaudeQuotaResult {
  models: QuotaModel[];
  email?: string;
  error?: string;
}

export interface CodexQuotaResult {
  plan?: string;
  limits: Array<{ name: string; percentage: number; resetTime?: string; used?: boolean }>;
  error?: string;
}

export interface KiroQuotaResult {
  models: QuotaModel[];
  plan?: string;
  email?: string;
  tokenExpiresAt?: string;
  error?: string;
}

export interface CopilotQuotaResult {
  models: QuotaModel[];
  plan?: string;
  username?: string;
  error?: string;
}

export interface CursorQuotaResult {
  models: QuotaModel[];
  plan?: string;
  error?: string;
}

export interface OpenCodeGoQuotaResult {
  models: QuotaModel[];
  error?: string;
}

export interface GrokQuotaResult {
  models: QuotaModel[];
  keyName?: string;
  error?: string;
}

export interface FileQuota {
  fileId: string;
  filename: string;
  provider: string;
  providerKey: string;
  loading: boolean;
  error?: string;
  originalFile?: AuthFile;
  models?: QuotaModel[];
  plan?: string;
  limits?: Array<{ name: string; percentage: number; resetTime?: string; used?: boolean }>;
  email?: string;
}

export interface ProviderSection {
  provider: string;
  displayName: string;
  files: FileQuota[];
}
