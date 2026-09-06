import { useEffect, useCallback, useState, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { useConfigStore } from '@/features/settings/config.store';
import { useCliProxyStore } from '@/features/settings/cliProxy.store';
import { useHeaderRefresh } from '@/shared/hooks';
import { authFilesApi } from '@/services/api/auth.service';
import { useQuotaPresenter, ICON_MAP } from '@/features/quota/useQuotaPresenter';
import { getMachineUsage, type MachineUsageTotals } from '@/services/api/machineUsage.service';
import { useHistoryStore } from '@/features/dashboard/history.store';
import { fileWorstUsed, accountLabel } from '@/shared/utils/quota.helpers';

const HISTORY_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7',
  '#06b6d4', '#f97316', '#84cc16', '#e879f9', '#64748b',
];

export interface HistoryProvider {
  key: string;
  displayName: string;
  color: string;
}

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

export interface LiveUsageRow {
  fileId: string;
  label: string;
  displayName: string;
  value: string;
  detail?: string;
}

export function formatCompact(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Math.round(num).toString();
}

export function useDashboardPresenter() {
  const { connectionStatus, checkAuth, updateConnectionStatus, apiBase } = useAuthStore();
  const { fetchConfig } = useConfigStore();
  const { isApiHealthy, checkApiHealth } = useCliProxyStore();
  const quota = useQuotaPresenter();

  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);
  const [machineTotals, setMachineTotals] = useState<MachineUsageTotals | null>(null);

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

  useEffect(() => {
    getMachineUsage().then((snap) => {
      if (snap?.totals) setMachineTotals(snap.totals);
    });
  }, []);

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

  const liveTokenRows: LiveUsageRow[] = useMemo(() => {
    const rows: LiveUsageRow[] = [];
    for (const s of quota.sections) {
      for (const f of s.files) {
        if (f.loading || f.error) continue;
        for (const m of f.models ?? []) {
          if (m.name === 'Total tokens' && m.displayValue) {
            rows.push({
              fileId: f.fileId,
              label: accountLabel(f),
              displayName: s.displayName,
              value: m.displayValue,
              detail: m.detail,
            });
          }
        }
      }
    }
    return rows;
  }, [quota.sections]);

  const snapshots = useHistoryStore((s) => s.snapshots);

  const historyProviders: HistoryProvider[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const snap of snapshots) {
      for (const a of snap.accounts) {
        if (!map.has(a.provider)) map.set(a.provider, a.displayName);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, displayName], i) => ({
        key,
        displayName,
        color: HISTORY_COLORS[i % HISTORY_COLORS.length],
      }));
  }, [snapshots]);

  const historyPoints: Record<string, number | string>[] = useMemo(() => {
    return snapshots.slice(-200).map((snap) => {
      const point: Record<string, number | string> = { t: snap.t };
      const worstByProvider = new Map<string, number>();
      for (const a of snap.accounts) {
        if (a.worst === null) continue;
        const prev = worstByProvider.get(a.provider);
        if (prev === undefined || a.worst > prev) worstByProvider.set(a.provider, a.worst);
      }
      for (const [key, worst] of worstByProvider) point[key] = worst;
      return point;
    });
  }, [snapshots]);

  return {
    connectionStatus,
    quotaLoading: quota.loading,
    activeAccountsCount,
    loadData,
    providerSummaries,
    attentionItems,
    machineTotals,
    liveTokenRows,
    historyProviders,
    historyPoints,
  };
}
