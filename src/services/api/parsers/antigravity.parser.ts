import type { QuotaModel } from '@/types';
import { formatTimeUntil } from '@/shared/utils/quota.helpers';

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
    if (id === 'rev19-uic3-1p') name = 'Gemini 2.5 Computer Use';
    else if (id === 'gemini-3-pro-image') name = 'Gemini 3 Pro Image';
    else if (id === 'gemini-2.5-flash-lite') name = 'Gemini 2.5 Flash Lite';
    else if (id === 'gemini-2.5-flash') name = 'Gemini 2.5 Flash';

    models.push({
      name,
      percentage: 0,
      resetTime: undefined,
      used: true
    });
  });

  return models.sort((a, b) => a.name.localeCompare(b.name));
}
