/**
 * OpenCode Go quota service.
 *
 * Fetches the Go subscription page (workspace ID + `auth` cookie) through the
 * proxy's generic /api-call passthrough (no authIndex: no token substitution,
 * custom Cookie header forwarded verbatim) and extracts the embedded usage
 * windows from the returned HTML.
 *
 * HTML scraping approach adapted from whosydd/opencode-quota
 * (MIT License, Copyright (c) 2026 GY) — reimplemented here with local
 * parsing helpers and ZeroLimit result shaping.
 */

import { apiCallApi } from './apiCall';
import { formatTimeUntil, normalizeNumberValue } from '@/shared/utils/quota.helpers';
import type { OpenCodeGoQuotaResult, QuotaModel } from '@/types';

interface GoWindow {
  quotaPercent: number;
  resetInSec: number;
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

function extractWindow(html: string, field: string): GoWindow | null {
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
  return { quotaPercent: Math.round(quotaPercent), resetInSec: Math.max(0, Math.round(resetInSec)) };
}

export function parseOpenCodeGoPage(html: string): OpenCodeGoQuotaResult {
  const nowSec = Math.floor(Date.now() / 1000);
  const windows: Array<{ name: string; window: GoWindow }> = [
    { name: 'Rolling', window: extractWindow(html, 'rollingUsage') as GoWindow },
    { name: 'Weekly', window: extractWindow(html, 'weeklyUsage') as GoWindow },
    { name: 'Monthly', window: extractWindow(html, 'monthlyUsage') as GoWindow },
  ].filter((w) => w.window !== null) as Array<{ name: string; window: GoWindow }>;

  if (windows.length === 0) {
    return { models: [], error: 'Could not parse quota data from the OpenCode Go page. The page format may have changed.' };
  }

  const models: QuotaModel[] = windows.map(({ name, window }) => ({
    name,
    percentage: Math.min(100, Math.max(0, 100 - window.quotaPercent)),
    resetTime: formatTimeUntil(nowSec + window.resetInSec),
  }));

  return { models };
}

export const opencodeGoApi = {
  async fetchQuota(workspaceId: string, authCookie: string): Promise<OpenCodeGoQuotaResult> {
    const wid = workspaceId.trim();
    const cookie = authCookie.trim();
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
