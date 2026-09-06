/**
 * Quota Helpers
 */

import type { AuthFile } from '@/types/authFile';
import type { FileQuota } from '@/types/quota';

// --- Parsers ---

export function normalizeAuthIndexValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

export function normalizeStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return null;
}

export function normalizeNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizePlanType(value: unknown): string | null {
  const normalized = normalizeStringValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function decodeBase64UrlPayload(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(padded);
    }
    if (typeof atob === 'function') {
      return atob(padded);
    }
  } catch {
    return null;
  }
  return null;
}

export function parseIdTokenPayload(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') {
    return Array.isArray(value) ? null : (value as Record<string, unknown>);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Continue to JWT parsing
  }
  const segments = trimmed.split('.');
  if (segments.length < 2) return null;
  const decoded = decodeBase64UrlPayload(segments[1]);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return null;
  }
  return null;
}

// --- Resolvers ---

export function extractCodexChatgptAccountId(value: unknown): string | null {
  const payload = parseIdTokenPayload(value);
  if (!payload) return null;
  return normalizeStringValue(payload.chatgpt_account_id ?? payload.chatgptAccountId);
}

export function resolveCodexChatgptAccountId(file: AuthFile): string | null {
  const metadata = file.metadata;
  const attributes = file.attributes;

  const candidates = [file.id_token, metadata?.id_token, attributes?.id_token];

  for (const candidate of candidates) {
    const id = extractCodexChatgptAccountId(candidate);
    if (id) return id;
  }

  return null;
}

export function resolveCodexPlanType(file: AuthFile): string | null {
  const metadata = file.metadata;
  const attributes = file.attributes;
  const idToken = typeof file.id_token === 'object' ? file.id_token : null;
  const metadataIdToken =
    metadata && typeof metadata.id_token === 'object'
      ? (metadata.id_token as Record<string, unknown>)
      : null;

  const candidates = [
    file.plan_type,
    file.planType,
    file['plan_type'],
    file['planType'],
    file.id_token,
    idToken?.plan_type,
    idToken?.planType,
    metadata?.plan_type,
    metadata?.planType,
    metadata?.id_token,
    metadataIdToken?.plan_type,
    metadataIdToken?.planType,
    attributes?.plan_type,
    attributes?.planType,
    attributes?.id_token
  ];

  for (const candidate of candidates) {
    const planType = normalizePlanType(candidate);
    if (planType) return planType;
  }

  return null;
}

// --- Legacy Parsers & Formatters (Ported) ---

export interface CodexUsageWindow {
  reset_at?: number | null;
  resetAt?: number | null;
  reset_after_seconds?: number | null;
  resetAfterSeconds?: number | null;
  remaining_count?: number | null;
  remainingCount?: number | null;
  total_count?: number | null;
  totalCount?: number | null;
  used_percent?: number | null;
  usedPercent?: number | null;
}

export interface CodexUsagePayload {
  rate_limit?: Record<string, CodexUsageWindow | boolean | undefined>;
  rateLimit?: Record<string, CodexUsageWindow | boolean | undefined>;
  code_review_rate_limit?: Record<string, CodexUsageWindow | boolean | undefined>;
  codeReviewRateLimit?: Record<string, CodexUsageWindow | boolean | undefined>;
  plan_type?: string;
  planType?: string;
  [key: string]: unknown;
}

export function parseCodexUsagePayload(payload: unknown): CodexUsagePayload | null {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as CodexUsagePayload;
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object') {
    return payload as CodexUsagePayload;
  }
  return null;
}

export function formatTimeUntil(targetTime: number | string): string {
  let targetMs: number;

  if (typeof targetTime === 'string') {
    const d = new Date(targetTime);
    if (Number.isNaN(d.getTime())) return '-';
    targetMs = d.getTime();
  } else {
    // Assume seconds if small, else milliseconds
    targetMs = targetTime < 10000000000 ? targetTime * 1000 : targetTime;
  }

  const now = Date.now();
  const diff = targetMs - now;

  if (diff <= 0) return 'Ready';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatCodexResetLabel(window?: CodexUsageWindow | null): string {
  if (!window) return '-';
  const resetAt = normalizeNumberValue(window.reset_at ?? window.resetAt);
  if (resetAt !== null && resetAt > 0) {
    return formatTimeUntil(resetAt);
  }
  const resetAfter = normalizeNumberValue(window.reset_after_seconds ?? window.resetAfterSeconds);
  if (resetAfter !== null && resetAfter > 0) {
    const targetSeconds = Math.floor(Date.now() / 1000 + resetAfter);
    return formatTimeUntil(targetSeconds);
  }
  return '-';
}

export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Highest consumed-% on one account, ignoring display-only (separate) lines like burn totals. */
export function fileWorstUsed(f: FileQuota): number | null {
  let worst: number | null = null;
  for (const m of f.models ?? []) {
    if (m.separate || typeof m.percentage !== 'number') continue;
    if (worst === null || m.percentage > worst) worst = m.percentage;
  }
  for (const l of f.limits ?? []) {
    if (typeof l.percentage !== 'number') continue;
    if (worst === null || l.percentage > worst) worst = l.percentage;
  }
  return worst;
}

export function accountLabel(f: FileQuota): string {
  return f.email || f.filename.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}
