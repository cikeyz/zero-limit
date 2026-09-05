/**
 * OpenCode Go quota service.
 *
 * Primary path: the official usage API (`GET /zen/go/v1/usage`, Bearer
 * API key from the local OpenCode `opencode-go` entry).
 *
 * API contract (server source:
 * `packages/console/app/src/routes/zen/go/v1/usage.ts` -> `formatUsage()`
 * over `Subscription.analyzeRollingUsage / analyzeWeeklyUsage /
 * analyzeMonthlyUsage` in `packages/console/core/src/subscription.ts`):
 * - Shape: `{ usage: { rolling, weekly, monthly } }`, each window
 *   `{ status: "ok" | "rate-limited", percent: number, resetsAt: string }`.
 * - `percent` is `Math.floor(min(100, usage / limit * 100))`: a floored
 *   INTEGER (0-100; 100 when rate-limited). It can never carry the
 *   dashboard's 1-decimal precision, so we must NOT synthesize decimals
 *   from it (no +0.5 / interpolation): preserve the value as-is.
 * - `resetsAt` is an ISO timestamp computed server-side as
 *   `now + resetInSec * 1000` (`resetInSec` itself is `Math.ceil`ed).
 *   Convert to display text with `formatTimeUntil`, same as the page path.
 * - `status` is informational (`rate-limited` accompanies `percent: 100`
 *   and is still a valid meter: the dashboard renders it as 100%, so we
 *   keep such windows instead of dropping them).
 * - The route takes no query params and exposes no richer fields (no
 *   usage/limit dollars, no decimals). There is no better official
 *   endpoint: `/docs/go` documents only `/zen/go/v1/models`, and the Zen
 *   balance has no official API (tracked in `anomalyco/opencode#44189`).
 *
 * Fallback path: the workspace Go page (workspace ID + `auth` cookie)
 * scraped for the same windows. The page's `queryLiteSubscription` (in
 * `packages/console/app/src/routes/workspace/[id]/go/lite-section.tsx`)
 * reuses the same analyze* results for `status`/`resetInSec` but OVERWRITES
 * `usagePercent` with `getUsagePercent()` (`packages/console/app/src/lib/
 * lite-usage.ts`: `Math.round(amount / limit * 1000) / 10`, 1-decimal).
 * The SSR hydration objects therefore carry `{ usagePercent (1-decimal),
 * resetInSec, usage, limit }`, and the page renders e.g. `7.2%` where the
 * API reports `percent: 7` (floor). The page scrape is the most precise
 * source when a cookie is available; the API is the best source for
 * key-only auth (account-wide, server-accurate, no cookie needed).
 * HTML scraping approach adapted from whosydd/opencode-quota (MIT License,
 * Copyright (c) 2026 GY).
 */

import { apiCallApi } from './apiCall';
import { formatTimeUntil, normalizeNumberValue } from '@/shared/utils/quota.helpers';
import type { OpenCodeGoQuotaResult, QuotaModel } from '@/types';

const OFFICIAL_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage';

export interface OpenCodeGoCredentials {
  apiKey?: string;
  workspaceId?: string;
  authCookie?: string;
}

/** Accepts a bare ID, a workspace URL, or a URL with a /go suffix. */
export function extractWorkspaceId(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/wrk_[A-Za-z0-9]+/);
  if (match) return match[0];
  const cleaned = trimmed.replace(/\/go\/?$/, '').replace(/\/+$/, '');
  return cleaned || null;
}

interface OfficialWindow {
  status?: unknown;
  percent?: unknown;
  resetsAt?: unknown;
}

function officialModel(name: string, window: OfficialWindow | undefined, sortOrder: number): QuotaModel | null {  if (!window || typeof window !== 'object') return null;
  // `status` is "ok" normally and "rate-limited" at 100%: both are valid
  // meters (the dashboard renders rate-limited as 100%), so only reject
  // unknown status values, never a known one. `percent` is a server-floored
  // integer: keep full precision as-is, do not round or adjust.
  if (window.status !== undefined && window.status !== 'ok' && window.status !== 'rate-limited') return null;
  const used = normalizeNumberValue(window.percent);
  if (used === null) return null;
  const resetsAt = window.resetsAt;
  return {
    name,
    // Shown as-used to mirror the Go page (unlike percent-left providers).
    percentage: Math.min(100, Math.max(0, used)),
    resetTime: typeof resetsAt === 'string' && resetsAt ? formatTimeUntil(resetsAt) : undefined,
    used: true,
    sortOrder,
  };
}

export function parseOfficialUsage(body: unknown): OpenCodeGoQuotaResult {
  const payload = (body ?? null) as Record<string, unknown> | null;
  const usage = payload?.usage as Record<string, OfficialWindow> | undefined;
  if (!payload || typeof payload !== 'object' || !usage || typeof usage !== 'object') {
    return { models: [], error: 'Unexpected OpenCode Go response shape' };
  }
  const models: QuotaModel[] = [];
  for (const [name, key, sortOrder] of [['Rolling', 'rolling', 1], ['Weekly', 'weekly', 2], ['Monthly', 'monthly', 3]] as const) {
    const model = officialModel(name, usage[key], sortOrder);
    if (model) models.push(model);
  }
  if (models.length === 0) {
    return { models: [], error: 'No OpenCode Go windows returned' };
  }
  return { models };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readObjectLiteral(html: string, start: number): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTick = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if ((inSingle || inDouble || inTick) && ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTick && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTick && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTick = !inTick;
      continue;
    }
    if (inSingle || inDouble || inTick) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

function extractObjectLiteral(html: string, field: string): string | null {
  const patterns = [
    new RegExp(`${escapeRegExp(field)}\\s*:\\s*\\$R\\[\\d+\\]\\s*=\\s*\\{`),
    new RegExp(`"${escapeRegExp(field)}"\\s*:\\s*\\{`),
    new RegExp(`${escapeRegExp(field)}\\s*:\\s*\\{`),
    new RegExp(`${escapeRegExp(field)}\\s*=\\s*\\{`),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match || match.index === undefined) continue;
    const start = match.index + match[0].lastIndexOf('{');
    const literal = readObjectLiteral(html, start);
    if (literal) return literal;
  }
  return null;
}

function parseLooseObjectLiteral(input: string): Record<string, unknown> {
  const normalized = input
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/'((?:\\.|[^'\\])*)'/g, (_m, value: string) => `"${value.replace(/"/g, '\\"')}"`)
    .replace(/("(?:\\.|[^"\\])*")|\bundefined\b/g, (m, quoted) => quoted ?? 'null')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(normalized) as Record<string, unknown>;
}

function extractWindow(html: string, field: string): { quotaPercent: number; resetInSec: number } | null {
  const literal = extractObjectLiteral(html, field);
  if (!literal) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = parseLooseObjectLiteral(literal);
  } catch {
    return null;
  }
  const quotaPercent = normalizeNumberValue(parsed.usagePercent);
  const resetInSec = normalizeNumberValue(parsed.resetInSec);
  if (quotaPercent === null || resetInSec === null) return null;
  // Preserve the page's 1-decimal `usagePercent` (e.g. 7.2): rounding here
  // would throw away the precision advantage the scrape has over the API's
  // floored integer. `resetInSec` is whole seconds, so rounding it is safe.
  return { quotaPercent, resetInSec: Math.max(0, Math.round(resetInSec)) };
}

export function parseOpenCodeGoPage(html: string): OpenCodeGoQuotaResult {
  const nowSec = Math.floor(Date.now() / 1000);
  const found = [
    { name: 'Rolling', window: extractWindow(html, 'rollingUsage') },
    { name: 'Weekly', window: extractWindow(html, 'weeklyUsage') },
    { name: 'Monthly', window: extractWindow(html, 'monthlyUsage') },
  ].filter((w): w is { name: string; window: { quotaPercent: number; resetInSec: number } } => w.window !== null);

  if (found.length === 0) {
    return { models: [], error: 'Could not parse quota data from the OpenCode Go page. The page format may have changed.' };
  }

  return {
    models: found.map(({ name, window }) => ({
      name,
      percentage: Math.min(100, Math.max(0, window.quotaPercent)),
      resetTime: formatTimeUntil(nowSec + window.resetInSec),
      used: true,
      sortOrder: name === 'Rolling' ? 1 : name === 'Weekly' ? 2 : 3,
    })),
  };
}

export const opencodeGoApi = {
  async fetchQuota(creds: OpenCodeGoCredentials): Promise<OpenCodeGoQuotaResult> {
    const apiKey = (creds.apiKey || '').trim();
    if (apiKey) {
      try {
        const result = await apiCallApi.request({
          method: 'GET',
          url: OFFICIAL_USAGE_URL,
          header: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        });
        if (result.statusCode === 401 || result.statusCode === 403) {
          return { models: [], error: 'OpenCode Go API key invalid. Re-detect or check your OpenCode login.' };
        }
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return { models: [], error: `OpenCode Go request failed (HTTP ${result.statusCode})` };
        }
        return parseOfficialUsage(result.body);
      } catch (err) {
        return { models: [], error: (err as Error).message };
      }
    }

    const wid = extractWorkspaceId(creds.workspaceId || '');
    const cookie = (creds.authCookie || '').trim();
    if (!wid || !cookie) {
      return { models: [], error: 'OpenCode Go is not connected' };
    }

    try {
      const result = await apiCallApi.request({
        method: 'GET',
        url: `https://opencode.ai/workspace/${encodeURIComponent(wid)}/go`,
        header: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Cookie: `auth=${cookie}`,
          'User-Agent': 'zerolimit-opencode-go',
        },
      });

      if (result.statusCode === 401 || result.statusCode === 403) {
        return { models: [], error: 'OpenCode Go authentication failed. Refresh your auth cookie.' };
      }

      if (result.statusCode < 200 || result.statusCode >= 300) {
        return { models: [], error: `OpenCode Go request failed (HTTP ${result.statusCode})` };
      }

      const html = result.bodyText || (typeof result.body === 'string' ? result.body : '');
      if (!html) {
        return { models: [], error: 'Empty response from OpenCode Go page' };
      }

      return parseOpenCodeGoPage(html);
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  },
};
