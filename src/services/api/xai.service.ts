import { apiCallApi } from './apiCall';
import { clampPct, normalizeNumberValue } from '@/shared/utils/quota.helpers';
import type { GrokQuotaResult, QuotaModel } from '@/types';

const API_KEY_URL = 'https://api.x.ai/v1/api-key';
const MODELS_URL = 'https://api.x.ai/v1/models';


function firstHeader(headers: Record<string, string[]>, name: string): string | null {
  for (const [key, values] of Object.entries(headers || {})) {
    if (key.toLowerCase() === name.toLowerCase() && values.length > 0) {
      return values[0];
    }
  }
  return null;
}

export function parseXaiQuota(
  body: unknown,
  headers: Record<string, string[]> = {}
): GrokQuotaResult {
  const payload = (body ?? null) as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { models: [], error: 'Unexpected xAI response shape' };
  }

  const models: QuotaModel[] = [];
  const remaining = normalizeNumberValue(payload.remaining_balance);
  const granted = normalizeNumberValue(payload.total_granted);
  const spent = normalizeNumberValue(payload.spent_balance);
  const keyName = typeof payload.name === 'string' ? payload.name : undefined;

  if (remaining !== null && granted !== null && granted > 0) {
    const spentVal = spent !== null ? spent : Math.max(0, granted - remaining);
    models.push({
      name: 'Credits',
      percentage: clampPct((spentVal / granted) * 100),
      displayValue: `$${spentVal.toFixed(2)} of $${granted.toFixed(2)} spent`,
      used: true,
    });
  } else if (spent !== null) {
    models.push({
      name: 'Credits',
      percentage: 0,
      displayValue: `$${spent.toFixed(2)} spent`,
      used: true,
    });
  }

  // Rate limits ride along on the models endpoint headers (best effort).
  const reqLimit = normalizeNumberValue(firstHeader(headers, 'x-ratelimit-limit-requests'));
  const reqRemaining = normalizeNumberValue(firstHeader(headers, 'x-ratelimit-remaining-requests'));
  const tokLimit = normalizeNumberValue(firstHeader(headers, 'x-ratelimit-limit-tokens'));
  const tokRemaining = normalizeNumberValue(firstHeader(headers, 'x-ratelimit-remaining-tokens'));
  if (reqLimit !== null && reqLimit > 0 && reqRemaining !== null) {
    models.push({ name: 'Requests', percentage: clampPct(100 - (reqRemaining / reqLimit) * 100), used: true });
  }
  if (tokLimit !== null && tokLimit > 0 && tokRemaining !== null) {
    models.push({ name: 'Tokens', percentage: clampPct(100 - (tokRemaining / tokLimit) * 100), used: true });
  }

  if (models.length === 0) {
    return { models: [], error: 'No Grok credit figures returned' };
  }

  return { models, keyName };
}

export const xaiApi = {
  async fetchQuota(apiKey: string): Promise<GrokQuotaResult> {
    const key = apiKey.trim();
    if (!key) {
      return { models: [], error: 'Grok is not connected' };
    }
    const header = { Authorization: `Bearer ${key}` };

    try {
      const keyResult = await apiCallApi.request({ method: 'GET', url: API_KEY_URL, header });

      if (keyResult.statusCode === 401 || keyResult.statusCode === 403) {
        return { models: [], error: 'xAI API key invalid. Check the key in xAI console.' };
      }
      if (keyResult.statusCode < 200 || keyResult.statusCode >= 300) {
        return { models: [], error: `xAI request failed (HTTP ${keyResult.statusCode})` };
      }

      let headers: Record<string, string[]> = {};
      try {
        const modelsResult = await apiCallApi.request({ method: 'GET', url: MODELS_URL, header });
        if (modelsResult.statusCode >= 200 && modelsResult.statusCode < 300) {
          headers = modelsResult.header || {};
        }
      } catch {
        // Rate limits are informational; credits above are the core result.
      }

      return parseXaiQuota(keyResult.body, headers);
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  },
};
