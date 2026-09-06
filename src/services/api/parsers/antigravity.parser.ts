import type { QuotaModel } from '@/types';
import { clampPct, formatTimeUntil } from '@/shared/utils/quota.helpers';

export function parseAntigravityModels(body: unknown): QuotaModel[] {
  const models: QuotaModel[] = [];
  const payload = body as Record<string, unknown> | null;
  if (!payload?.models || typeof payload.models !== 'object') return models;

  const modelsData = payload.models as Record<string, unknown>;

  Object.entries(modelsData).forEach(([key, value]) => {
    const model = value as Record<string, unknown>;

    if (!model || typeof model !== 'object') return;
    if (model.isInternal === true || key.startsWith('chat_') || key === 'tab_flash_lite_preview' || key === 'tab_jump_flash_lite_preview') return;

    let name = (model.displayName as string) || (model.display_name as string);
    if (!name) {
      if (key === 'gemini-3.7-flash-tiered') name = 'Gemini 3.7 Flash (Tiered)';
      else if (key === 'gemini-3.6-flash-tiered') name = 'Gemini 3.6 Flash (Tiered)';
      else if (key === 'gemini-3.6-flash-low') name = 'Gemini 3.6 Flash (Low)';
      else if (key === 'gemini-3.6-flash-medium') name = 'Gemini 3.6 Flash (Medium)';
      else if (key === 'gemini-3.6-flash-high') name = 'Gemini 3.6 Flash (High)';
      else if (key === 'claude-opus-4-6-thinking') name = 'Claude Opus 4.6 (Thinking)';
      else if (key === 'claude-sonnet-4-6') name = 'Claude Sonnet 4.6';
      else if (key === 'gpt-oss-120b-medium') name = 'GPT-OSS 120B (Medium)';
      else name = key;
    }

    const quotaInfo = (model.quotaInfo ?? model.quota_info) as Record<string, unknown> | undefined;
    const source = quotaInfo ?? model;
    const remaining = source.remainingFraction ?? source.remaining_fraction ?? source.remaining;

    let parsedRemaining: number | null = null;
    if (typeof remaining === 'number') {
      parsedRemaining = remaining;
    } else if (typeof remaining === 'string') {
      const parsed = parseFloat(remaining);
      if (!isNaN(parsed)) parsedRemaining = parsed;
    }

    if (parsedRemaining === null) {
      const hasResetTime = quotaInfo && (quotaInfo.resetTime || quotaInfo.reset_time);
      parsedRemaining = hasResetTime ? 0 : 1;
    }

    const reset = source.resetTime ?? source.reset_time;
    let resetTime: string | undefined;
    if (typeof reset === 'string') {
      resetTime = formatTimeUntil(reset);
    }

    models.push({
      name,
      percentage: Math.round((1 - parsedRemaining) * 100),
      resetTime,
      used: true
    });
  });

  const extraIds = new Set<string>();

  const addIds = (ids: unknown) => {
    if (Array.isArray(ids)) {
      ids.forEach(id => {
        if (typeof id === 'string') extraIds.add(id);
      });
    }
  };

  if (Array.isArray(payload.agentModelSorts)) {
    payload.agentModelSorts.forEach((sort: Record<string, unknown>) => {
      if (sort?.groups && Array.isArray(sort.groups)) {
        (sort.groups as Record<string, unknown>[]).forEach((group) => {
          addIds(group.modelIds);
        });
      }
    });
  }

  addIds(payload.commandModelIds);
  addIds(payload.tabModelIds);
  addIds(payload.imageGenerationModelIds);
  addIds(payload.mqueryModelIds);
  addIds(payload.webSearchModelIds);
  addIds(payload.defaultAgentModelId ? [payload.defaultAgentModelId] : []);

  const existingKeys = new Set(Object.keys(modelsData));

  extraIds.forEach(id => {
    if (existingKeys.has(id)) return;
    if (id.startsWith('chat_') || id === 'tab_flash_lite_preview' || id === 'tab_jump_flash_lite_preview') return;

    let name = id;
    if (id === 'gemini-3.7-flash-tiered') name = 'Gemini 3.7 Flash (Tiered)';
    else if (id === 'gemini-3.6-flash-tiered') name = 'Gemini 3.6 Flash (Tiered)';
    else if (id === 'claude-opus-4-6-thinking') name = 'Claude Opus 4.6 (Thinking)';
    else if (id === 'claude-sonnet-4-6') name = 'Claude Sonnet 4.6';
    else if (id === 'gpt-oss-120b-medium') name = 'GPT-OSS 120B (Medium)';

    models.push({
      name,
      percentage: 0,
      resetTime: undefined,
      used: true
    });
  });

  return models.sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Parses POST /v1internal:retrieveUserQuotaSummary — the same grouped
 * weekly + 5h buckets the Antigravity app itself renders
 * (Gemini Models / Claude and GPT models × Weekly / Five Hour).
 */
export function parseAntigravitySummary(body: unknown): QuotaModel[] {
  const payload = (body ?? null) as Record<string, unknown> | null;
  const groups = payload?.groups;
  if (!payload || typeof payload !== 'object' || !Array.isArray(groups)) return [];

  const models: QuotaModel[] = [];
  for (const entry of groups) {
    if (!entry || typeof entry !== 'object') continue;
    const group = entry as Record<string, unknown>;
    const display = typeof group.displayName === 'string' ? group.displayName : '';
    const isClaude = display.toLowerCase().includes('claude') || display.toLowerCase().includes('gpt');
    const isGemini = display.toLowerCase().includes('gemini');
    const short = isClaude ? 'Claude' : isGemini ? 'Gemini' : display.trim();
    if (!short) continue;

    const buckets = group.buckets;
    if (!Array.isArray(buckets)) continue;
    for (const item of buckets) {
      if (!item || typeof item !== 'object') continue;
      const bucket = item as Record<string, unknown>;
      const fraction = bucket.remainingFraction ?? bucket.remaining_fraction;
      if (typeof fraction !== 'number' || !Number.isFinite(fraction)) continue;
      const window = typeof bucket.window === 'string' ? bucket.window.toLowerCase() : '';
      const isWeekly = window.includes('week');
      const label = isWeekly
        ? 'Weekly'
        : window.includes('5h') || window.includes('5-h') || window.includes('hour')
          ? '5-Hour'
          : (typeof bucket.displayName === 'string' && bucket.displayName) || window || 'Quota';
      const reset = bucket.resetTime ?? bucket.reset_time;
      models.push({
        name: `${short} ${label}`,
        percentage: clampPct((1 - fraction) * 100),
        resetTime: typeof reset === 'string' && reset ? formatTimeUntil(reset) : undefined,
        used: true,
        // Gemini pools first, then Claude; 5-hour before Weekly inside each.
        sortOrder: (isGemini ? 0 : 10) + (isWeekly ? 2 : 1),
      });
    }
  }
  models.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  return models;
}
