import { apiCallApi } from './apiCall';
import { formatTimeUntil, normalizeNumberValue } from '@/shared/utils/quota.helpers';
import type { QuotaModel } from '@/types';

export interface GrokCliQuotaResult {
  models: QuotaModel[];
  tier?: string;
  refreshed?: { key: string; refresh: string };
  error?: string;
}

const BASE = 'https://cli-chat-proxy.grok.com/v1';
const TOKEN_URL = 'https://auth.x.ai/oauth2/token';
const CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function cliHeaders(key: string): Record<string, string> {
  return {
    authorization: `Bearer ${key}`,
    'x-xai-token-auth': 'xai-grok-cli',
    accept: 'application/json',
  };
}

interface MonthlyUsage {
  monthlyLimit: number;
  used: number;
  billingPeriodEnd: string;
}

function parseMonthlyUsage(payload: unknown): MonthlyUsage | null {
  if (!payload || typeof payload !== 'object') return null;
  const config = (payload as Record<string, unknown>).config;
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;
  const limit = (c.monthlyLimit as Record<string, unknown> | undefined)?.val;
  const used = (c.used as Record<string, unknown> | undefined)?.val;
  const end = c.billingPeriodEnd;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) return null;
  if (typeof used !== 'number' || !Number.isFinite(used)) return null;
  if (typeof end !== 'string' || Number.isNaN(new Date(end).getTime())) return null;
  return { monthlyLimit: limit, used, billingPeriodEnd: end };
}

export function parseGrokCliBilling(
  monthlyBody: unknown,
  weeklyBody: unknown,
  settingsBody: unknown
): GrokCliQuotaResult {
  const monthly = parseMonthlyUsage(monthlyBody);
  if (!monthly) {
    return { models: [], error: 'Unexpected Grok billing response shape' };
  }

  const models: QuotaModel[] = [{
    name: 'Monthly usage',
    percentage: clampPct(100 - (monthly.used / monthly.monthlyLimit) * 100),
    displayValue: `${monthly.used.toLocaleString()} / ${monthly.monthlyLimit.toLocaleString()} credits`,
    resetTime: formatTimeUntil(monthly.billingPeriodEnd),
  }];

  const weekly = (weeklyBody ?? null) as Record<string, unknown> | null;
  const wConfig = weekly?.config as Record<string, unknown> | undefined;
  if (wConfig?.type === 'USAGE_PERIOD_TYPE_WEEKLY') {
    const pct = normalizeNumberValue(wConfig.creditUsagePercent);
    const end = wConfig.billingPeriodEnd;
    if (pct !== null) {
      models.push({
        name: 'Weekly usage',
        percentage: clampPct(100 - pct),
        resetTime: typeof end === 'string' && end ? formatTimeUntil(end) : undefined,
      });
    }
  }

  let tier: string | undefined;
  const settings = (settingsBody ?? null) as Record<string, unknown> | null;
  if (settings && typeof settings.subscription_tier_display === 'string' && settings.subscription_tier_display) {
    tier = settings.subscription_tier_display;
  }

  return { models, tier };
}

async function refreshSession(refreshToken: string): Promise<{ key: string; refresh: string } | null> {
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });
  const result = await apiCallApi.request({
    method: 'POST',
    url: TOKEN_URL,
    header: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    data: form.toString(),
  });
  if (result.statusCode < 200 || result.statusCode >= 300) return null;
  const body = (result.body ?? null) as Record<string, unknown> | null;
  if (!body || typeof body.access_token !== 'string' || !body.access_token) return null;
  return {
    key: body.access_token,
    refresh: typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : refreshToken,
  };
}

async function getJson(key: string, url: string): Promise<{ status: number; body: unknown }> {
  const result = await apiCallApi.request({ method: 'GET', url, header: cliHeaders(key) });
  return { status: result.statusCode, body: result.body };
}

export const grokCliApi = {
  async fetchQuota(sessionKey: string, refreshToken?: string): Promise<GrokCliQuotaResult> {
    const key = sessionKey.trim();
    if (!key) {
      return { models: [], error: 'Grok CLI session is not connected' };
    }

    const loadAll = async (k: string) => {
      const [monthly, weekly, settings] = await Promise.all([
        getJson(k, `${BASE}/billing`),
        getJson(k, `${BASE}/billing?format=credits`),
        getJson(k, `${BASE}/settings`),
      ]);
      return { monthly, weekly, settings };
    };

    try {
      let current = await loadAll(key);
      let refreshed: { key: string; refresh: string } | undefined;

      if (current.monthly.status === 401 || current.monthly.status === 403) {
        const refresh = (refreshToken || '').trim();
        if (!refresh) {
          return { models: [], error: 'Grok session expired. Run grok login, then reconnect.' };
        }
        const next = await refreshSession(refresh);
        if (!next) {
          return { models: [], error: 'Grok session refresh failed. Run grok login, then reconnect.' };
        }
        refreshed = next;
        current = await loadAll(next.key);
      }

      if (current.monthly.status < 200 || current.monthly.status >= 300) {
        return { models: [], error: `Grok billing request failed (HTTP ${current.monthly.status})` };
      }

      const parsed = parseGrokCliBilling(
        current.monthly.body,
        current.weekly.status >= 200 && current.weekly.status < 300 ? current.weekly.body : null,
        current.settings.status >= 200 && current.settings.status < 300 ? current.settings.body : null
      );
      if (parsed.error || parsed.models.length === 0) {
        return { models: [], error: parsed.error || 'No Grok usage figures returned' };
      }
      return { ...parsed, refreshed };
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  },
};
