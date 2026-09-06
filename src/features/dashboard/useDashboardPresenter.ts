import { useEffect, useCallback, useState, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { useConfigStore } from '@/features/settings/config.store';
import { useCliProxyStore } from '@/features/settings/cliProxy.store';
import { useHeaderRefresh } from '@/shared/hooks';
import { authFilesApi } from '@/services/api/auth.service';
import { useQuotaPresenter, ICON_MAP } from '@/features/quota/useQuotaPresenter';
import type { FileQuota } from '@/types';

export interface ProviderSummary {
  provider: string;
  displayName: string;
  accounts: number;
  /** Highest consumed-% across non-separate models/limits, null while unknown. */
  worst: number | null;
  errors: number;
  loading: boolean;
  icon?: string;
  iconNeedsInvert: boolean;
}

export interface AttentionItem {
  fileId: string;
  label: string;
  provider: string;
  displayName: string;
  reason: 'error' | 'exhausted';
  detail: string;
}

const ATTENTION_THRESHOLD = 90;

/** Highest consumed-% on one account, ignoring display-only (separate) lines like burn totals. */
export function fileWorstUsed(f: FileQuota): number | null {
  const vals: number[] = [];
  for (const m of f.models ?? []) {
    if (!m.separate && typeof m.percentage === 'number') vals.push(m.percentage);
  }
  for (const l of f.limits ?? []) {
    if (typeof l.percentage === 'number') vals.push(l.percentage);
  }
  return vals.length > 0 ? Math.max(...vals) : null;
}

export function accountLabel(f: FileQuota): string {
  return f.email || f.filename.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}

export function useDashboardPresenter() {
  const { connectionStatus, checkAuth, updateConnectionStatus, apiBase } = useAuthStore();
  const { fetchConfig } = useConfigStore();
  const { isApiHealthy, checkApiHealth } = useCliProxyStore();
  const quota = useQuotaPresenter();

  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      await fetchConfig();
      const response = await authFilesApi.list();
      const filesList = response?.files ?? [];
      setActiveAccountsCount(filesList.length);
      quota.reload();
    } catch {
      // Error handled by store/api
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchConfig]);

  useEffect(() => {
    checkApiHealth(apiBase);
  }, [checkApiHealth, apiBase]);

  useEffect(() => {
    if (isApiHealthy) {
      checkAuth();
    } else {
      updateConnectionStatus('disconnected');
    }
  }, [isApiHealthy, checkAuth, updateConnectionStatus]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadData();
    }
  }, [connectionStatus, loadData]);

  useHeaderRefresh(loadData);

  const providerSummaries: ProviderSummary[] = useMemo(() => {
    return quota.sections
      .filter((s) => s.files.length > 0)
      .map((s) => {
        let worst: number | null = null;
        let errors = 0;
        let loading = false;
        for (const f of s.files) {
          if (f.loading) loading = true;
          if (f.error) errors += 1;
          const w = fileWorstUsed(f);
          if (w !== null && (worst === null || w > worst)) worst = w;
        }
        const iconInfo = ICON_MAP[s.provider] || { needsInvert: false };
        return {
          provider: s.provider,
          displayName: s.displayName,
          accounts: s.files.length,
          worst,
          errors,
          loading,
          icon: iconInfo.path,
          iconNeedsInvert: iconInfo.needsInvert ?? false,
        };
      })
      .sort((a, b) => (b.worst ?? -1) - (a.worst ?? -1));
  }, [quota.sections]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    for (const s of quota.sections) {
      for (const f of s.files) {
        if (f.loading) continue;
        if (f.error) {
          items.push({
            fileId: f.fileId,
            label: accountLabel(f),
            provider: s.provider,
            displayName: s.displayName,
            reason: 'error',
            detail: f.error,
          });
        } else {
          const w = fileWorstUsed(f);
          if (w !== null && w >= ATTENTION_THRESHOLD) {
            items.push({
              fileId: f.fileId,
              label: accountLabel(f),
              provider: s.provider,
              displayName: s.displayName,
              reason: 'exhausted',
              detail: `${Math.round(w)}% consumed`,
            });
          }
        }
      }
    }
    return items;
  }, [quota.sections]);

  return {
    connectionStatus,
    quotaLoading: quota.loading,
    activeAccountsCount,
    loadData,
    providerSummaries,
    attentionItems,
  };
}
