import type { QuotaModel, CursorQuotaResult } from '@/types';
import { formatTimeUntil, normalizeNumberValue } from '@/shared/utils/quota.helpers';

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

// Parses POST /aiserver.v1.DashboardService/GetCurrentPeriodUsage.
// Dashboard reports percent USED, while the UI renders percent LEFT.
export function parseCursorUsage(body: unknown): CursorQuotaResult {
  const payload = (body ?? null) as Record<string, unknown> | null;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { models: [], error: 'Unexpected Cursor response shape' };
  }

  const planUsage = payload.planUsage as Record<string, unknown> | undefined;
  if (!planUsage || typeof planUsage !== 'object') {
    const message =
      (payload as Record<string, unknown>).message ??
      (payload as Record<string, unknown>).error ??
      (payload as Record<string, unknown>).errorMessage;
    const detail = typeof message === 'string' && message.trim() ? `: ${message.trim()}` : '';
    return { models: [], error: `No Cursor usage figures returned${detail}` };
  }

  let resetTime: string | undefined;
  const cycleEnd = normalizeNumberValue(payload.billingCycleEnd);
  if (cycleEnd !== null) {
    resetTime = formatTimeUntil(cycleEnd);
  }

  const spendCents = normalizeNumberValue(planUsage.totalSpend);
  const spendLabel = spendCents !== null ? `$${(spendCents / 100).toFixed(2)} spend` : undefined;

  const models: QuotaModel[] = [];
  const totalUsed = normalizeNumberValue(planUsage.totalPercentUsed);
  const autoUsed = normalizeNumberValue(planUsage.autoPercentUsed);
  const apiUsed = normalizeNumberValue(planUsage.apiPercentUsed);

  if (totalUsed !== null) {
    models.push({ name: 'Plan usage', percentage: clampPct(100 - totalUsed), resetTime, displayValue: spendLabel });
  }
  if (autoUsed !== null) {
    models.push({ name: 'Auto models', percentage: clampPct(100 - autoUsed), resetTime });
  }
  if (apiUsed !== null) {
    models.push({ name: 'API usage', percentage: clampPct(100 - apiUsed), resetTime });
  }

  if (models.length === 0) {
    return { models: [], error: 'No Cursor usage figures returned' };
  }

  return { models };
}
