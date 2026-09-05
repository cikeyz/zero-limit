import { apiCallApi } from './apiCall';
import { formatTimeUntil, normalizeNumberValue } from '@/shared/utils/quota.helpers';
import type { QuotaModel } from '@/types';

export interface CommandCodeQuotaResult {
  models: QuotaModel[];
  email?: string;
  error?: string;
}

const BASE = 'https://api.commandcode.ai';

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

interface WindowLimit {
  used: number | null;
  cap: number | null;
  resetAt: number | null;
}

function readWindow(raw: unknown): WindowLimit | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  return {
    used: normalizeNumberValue(w.used),
    cap: normalizeNumberValue(w.cap),
    resetAt: normalizeNumberValue(w.resetAt),
  };
}

export function parseCommandCodeQuota(
  whoami: unknown,
  credits: unknown,
  subscriptions: unknown,
  summary: unknown = null
): CommandCodeQuotaResult {
  const models: QuotaModel[] = [];
  let email: string | undefined;

  const who = (whoami ?? null) as Record<string, unknown> | null;
  const user = who?.user as Record<string, unknown> | undefined;
  if (user && typeof user.email === 'string' && user.email) {
    email = user.email;
  }

  const cred = (credits ?? null) as Record<string, unknown> | null;
  const windows = cred?.windowLimits as Record<string, unknown> | undefined;
  const limited = windows?.limited === true;

  const inner = cred?.credits as Record<string, unknown> | undefined;
  const monthlySource = inner && typeof inner === 'object' ? inner : cred;

  const pushWindow = (name: string, raw: unknown) => {
    const w = readWindow(raw);
    if (!w || w.used === null || w.cap === null || w.cap <= 0) return;
    models.push({
      name,
      percentage: clampPct((w.used / w.cap) * 100),
      resetTime: w.resetAt !== null ? formatTimeUntil(w.resetAt) : undefined,
      used: true,
    });
  };

  if (cred && limited && windows) {
    pushWindow('5-hour window', windows.fiveHour);
    pushWindow('Weekly window', windows.weekly);
  }

  const monthly = normalizeNumberValue(monthlySource?.monthlyCredits);
  let monthlyReset: string | undefined;
  const sub = (subscriptions ?? null) as Record<string, unknown> | null;
  const data = sub?.data as Record<string, unknown> | undefined;
  if (data && typeof data.currentPeriodEnd === 'string' && data.currentPeriodEnd) {
    monthlyReset = formatTimeUntil(data.currentPeriodEnd);
  }
  if (monthly !== null) {
    const sum = (summary ?? null) as Record<string, unknown> | null;
    const billed = normalizeNumberValue(sum?.totalMonthlyCredits);
    if (billed !== null && billed > 0) {
      const pool = monthly + billed;
      models.push({
        name: 'Monthly credits',
        percentage: clampPct((billed / pool) * 100),
        displayValue: `$${monthly.toFixed(2)} remaining · $${billed.toFixed(2)} billed`,
        resetTime: monthlyReset,
        used: true,
      });
    } else {
      models.push({
        name: 'Monthly credits',
        percentage: 0,
        displayValue: `$${monthly.toFixed(2)} remaining`,
        resetTime: monthlyReset,
        used: true,
      });
    }
    const totalTokens = normalizeNumberValue(sum?.totalTokens);
    const totalCount = normalizeNumberValue(sum?.totalCount);
    if (totalTokens !== null && totalTokens > 0) {
      const compact = totalTokens >= 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(1)}M` : `${Math.round(totalTokens).toLocaleString()}`;
      models.push({
        name: 'Total tokens',
        percentage: 0,
        displayValue: `${compact} tokens${totalCount !== null && totalCount > 0 ? ` · ${Math.round(totalCount).toLocaleString()} runs` : ''} (month to date)`,
        resetTime: monthlyReset,
        used: true,
      });
    }
  }

  if (models.length === 0) {
    return { models: [], error: 'No Command Code usage figures returned' };
  }
  return { models, email };
}

async function getJson(apiKey: string, endpoint: string): Promise<{ status: number; body: unknown }> {
  const result = await apiCallApi.request({
    method: 'GET',
    url: `${BASE}${endpoint}`,
    header: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
  });
  return { status: result.statusCode, body: result.body };
}

export const commandcodeApi = {
  async fetchQuota(apiKey: string): Promise<CommandCodeQuotaResult> {
    const key = apiKey.trim();
    if (!key) {
      return { models: [], error: 'Command Code is not connected' };
    }

    try {
      const [whoami, credits, subscriptions] = await Promise.all([
        getJson(key, '/alpha/whoami'),
        getJson(key, '/alpha/billing/credits'),
        getJson(key, '/alpha/billing/subscriptions'),
      ]);

      if (whoami.status === 401 || whoami.status === 403) {
        return { models: [], error: 'Command Code API key invalid. Check ~/.commandcode/auth.json for a fresh key.' };
      }

      const creditsBody = credits.status >= 200 && credits.status < 300 ? credits.body : null;
      const subsBody = subscriptions.status >= 200 && subscriptions.status < 300 ? subscriptions.body : null;

      // Month-to-date totals for pool derivation (best effort, never fatal).
      let summaryBody: unknown = null;
      try {
        const sub = (subsBody ?? null) as Record<string, unknown> | null;
        const data = sub?.data as Record<string, unknown> | undefined;
        const start = typeof data?.currentPeriodStart === 'string' && data.currentPeriodStart
          ? data.currentPeriodStart
          : `${new Date().toISOString().slice(0, 8)}01T00:00:00.000Z`;
        const summary = await getJson(key, `/alpha/usage/summary?since=${encodeURIComponent(start)}`);
        if (summary.status >= 200 && summary.status < 300) summaryBody = summary.body;
      } catch {
        // Totals are informational; windows above are the core result.
      }

      const result = parseCommandCodeQuota(whoami.body, creditsBody, subsBody, summaryBody);
      if (result.error || result.models.length === 0) {
        return { models: [], error: result.error || 'No Command Code usage figures returned' };
      }
      return result;
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  },
};
