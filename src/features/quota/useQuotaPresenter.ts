import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { authFilesApi } from '@/services/api/auth.service';
import { quotaApi } from '@/services/api/quota.service';
import type { AuthFile, FileQuota, ProviderSection } from '@/types';
import type { ProviderFilterItem } from '@/features/quota/components/ProviderFilter';
import { resolveCodexChatgptAccountId, resolveCodexPlanType } from '@/shared/utils/quota.helpers';
import { useOpenCodeGoStore } from '@/features/providers/opencodeGo.store';
import { opencodeGoApi, extractWorkspaceId } from '@/services/api/opencodeGo.service';
import { useXaiStore } from '@/features/providers/xai.store';
import { xaiApi } from '@/services/api/xai.service';
import { grokCliApi } from '@/services/api/grokCli.service';
import { accountLabelKey, useAccountLabelsStore } from '@/features/providers/accountLabels.store';
import { useFileHealthStore } from '@/features/quota/fileHealth.store';
import { useCommandCodeStore } from '@/features/providers/commandcode.store';
import { commandcodeApi } from '@/services/api/commandcode.service';

function getProviderType(file: AuthFile): 'antigravity' | 'codex' | 'kiro' | 'copilot' | 'anthropic' | 'cursor' | 'opencode-go' | 'grok' | 'commandcode' | 'unknown' {
  const filename = (file?.filename || file?.id || '').toLowerCase();

  if (filename.startsWith('antigravity-') || filename.includes('antigravity')) return 'antigravity';
  if (filename.startsWith('codex-') || filename.includes('codex')) return 'codex';
  if (filename.startsWith('kiro-') || filename.includes('kiro')) return 'kiro';
  if (filename.startsWith('github-copilot-') || filename.includes('copilot')) return 'copilot';
  if (filename.startsWith('claude-') || filename.includes('claude') || filename.includes('anthropic')) return 'anthropic';
  if (filename.startsWith('cursor-') || filename.includes('cursor')) return 'cursor';
  if (filename.includes('opencode')) return 'opencode-go';
  if (filename.includes('grok') || filename.includes('xai')) return 'grok';
  if (filename.includes('commandcode') || filename.includes('command-code') || filename.includes('command code')) return 'commandcode';

  const provider = (file?.provider || '').toLowerCase();
  if (provider.includes('antigravity')) return 'antigravity';
  if (provider.includes('codex')) return 'codex';
  if (provider.includes('kiro')) return 'kiro';
  if (provider.includes('copilot') || provider.includes('github')) return 'copilot';
  if (provider.includes('claude') || provider.includes('anthropic')) return 'anthropic';
  if (provider.includes('cursor')) return 'cursor';
  if (provider.includes('opencode')) return 'opencode-go';
  if (provider.includes('grok') || provider.includes('xai')) return 'grok';
  if (provider.includes('commandcode') || provider.includes('command-code') || provider.includes('command code')) return 'commandcode';

  return 'unknown';
}

function formatFilename(name: string): string {
  return name.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}

/** Account id suffix for synthetic per-account file ids (`<prefix>:<id>`). '' = legacy bare id. */
function syntheticAccountId(fileId: string, prefix: string): string | null {
  if (fileId === prefix) return '';
  if (fileId.startsWith(`${prefix}:`)) return fileId.slice(prefix.length + 1);
  return null;
}

export const ICON_MAP: Record<string, { path?: string; needsInvert: boolean }> = {
  antigravity: { path: '/antigravity/antigravity.svg', needsInvert: true },
  codex: { path: '/openai/openai.svg', needsInvert: true },
  kiro: { path: '/kiro/kiro.svg', needsInvert: true },
  copilot: { path: '/copilot/copilot.png', needsInvert: true },
  anthropic: { path: '/claude/claude.svg', needsInvert: true },
  cursor: { path: '/cursor/cursor.svg', needsInvert: true },
  'opencode-go': { path: '/opencode-go/opencode-go.svg', needsInvert: true },
  grok: { path: '/grok/grok.svg', needsInvert: true },
  commandcode: { path: '/commandcode/commandcode.svg', needsInvert: false },
};

const PROVIDER_DISPLAY: { key: string; name: string }[] = [
  { key: 'antigravity', name: 'Antigravity' },
  { key: 'anthropic', name: 'Claude' },
  { key: 'codex', name: 'Codex' },
  { key: 'commandcode', name: 'Command Code' },
  { key: 'cursor', name: 'Cursor' },
  { key: 'copilot', name: 'GitHub Copilot' },
  { key: 'grok', name: 'Grok' },
  { key: 'kiro', name: 'Kiro' },
  { key: 'opencode-go', name: 'OpenCode Go' },
  { key: 'unknown', name: 'Other' },
];

export function useQuotaPresenter() {
  const { isAuthenticated } = useAuthStore();
  const [sections, setSections] = useState<ProviderSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('antigravity');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  const fetchQuotaForFile = useCallback(async (fileId: string, providedFile?: AuthFile) => {
    let targetProvider: string | undefined;

    const maybeQuota = providedFile as unknown as FileQuota | undefined;
    // Synthetic per-account ids look like `opencode-go:<accountId>` (etc.);
    // the bare `opencode-go` form is the pre-multi-account id (accounts[0]).
    let manualAccountId = '';
    if (syntheticAccountId(fileId, 'opencode-go') !== null || maybeQuota?.providerKey === 'opencode-go') {
      targetProvider = 'opencode-go';
      manualAccountId = syntheticAccountId(fileId, 'opencode-go') ?? '';
    } else if (syntheticAccountId(fileId, 'grok') !== null || maybeQuota?.providerKey === 'grok') {
      targetProvider = 'grok';
      manualAccountId = syntheticAccountId(fileId, 'grok') ?? '';
    } else if (syntheticAccountId(fileId, 'commandcode') !== null || maybeQuota?.providerKey === 'commandcode') {
      targetProvider = 'commandcode';
      manualAccountId = syntheticAccountId(fileId, 'commandcode') ?? '';
    }

    if (providedFile) {
      const type = getProviderType(providedFile);
      if (type !== 'unknown') targetProvider = type;
    }

    if (!targetProvider) {
      for (const section of sections) {
        if (section.files.some(f => f.fileId === fileId)) {
          targetProvider = section.provider;
          break;
        }
      }
    }

    if (!targetProvider) return;

    setSections((prev) => prev.map(section => {
      if (section.provider !== targetProvider) return section;
      return {
        ...section,
        files: section.files.map(f => f.fileId === fileId ? { ...f, loading: true, error: undefined } : f)
      };
    }));

    try {
      // Manual-credential providers have no proxy auth file: skip file lookup.
      const isManualProvider =
        targetProvider === 'opencode-go' || targetProvider === 'grok' || targetProvider === 'commandcode';

      let authIndex = '';
      let file = providedFile;
      if (!isManualProvider) {
        if (!file) {
          const section = sections.find(s => s.provider === targetProvider);
          const fileQuota = section?.files.find(f => f.fileId === fileId);
          file = fileQuota?.originalFile;
        }

        if (!file) throw new Error('File not found');

        authIndex = (file['auth_index'] as string) || (file['authIndex'] as string) || file.id || file.filename;
        if (!authIndex) throw new Error('No auth index (auth_index, id or filename) found');
      }

      if (targetProvider === 'antigravity') {
        const result = await quotaApi.fetchAntigravity(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'antigravity' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, models: result.models, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'codex') {
        const accountId = resolveCodexChatgptAccountId(file);
        const result = await quotaApi.fetchCodex(authIndex, accountId || undefined);
        const plan = result.plan || resolveCodexPlanType(file) || 'Plus';

        setSections((prev) => prev.map(s => s.provider === 'codex' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan, limits: result.limits, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'kiro') {
        const result = await quotaApi.fetchKiro(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'kiro' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: result.plan, models: result.models, email: result.email, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'copilot') {
        const result = await quotaApi.fetchCopilot(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'copilot' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: result.plan, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'anthropic') {
        const result = await quotaApi.fetchClaude(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'anthropic' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, email: result.email, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'cursor') {
        const result = await quotaApi.fetchCursor(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'cursor' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: result.plan, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'opencode-go') {
        const accounts = useOpenCodeGoStore.getState().accounts;
        const account = manualAccountId ? accounts.find((a) => a.id === manualAccountId) : accounts[0];
        if (!account || (!account.apiKey && (!account.workspaceId || !account.authCookie))) {
          throw new Error('OpenCode Go is not connected');
        }
        const result = await opencodeGoApi.fetchQuota({
          apiKey: account.apiKey,
          workspaceId: account.workspaceId,
          authCookie: account.authCookie,
        });
        setSections((prev) => prev.map(s => s.provider === 'opencode-go' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'grok') {
        const { accounts, updateAccount } = useXaiStore.getState();
        const account = manualAccountId ? accounts.find((a) => a.id === manualAccountId) : accounts[0];
        if (!account || (!account.apiKey && !account.cliKey)) throw new Error('Grok is not connected');
        const result = account.cliKey
          ? await grokCliApi.fetchQuota(account.cliKey, account.cliRefresh || undefined)
          : await xaiApi.fetchQuota(account.apiKey);
        if (account.cliKey && 'refreshed' in result && result.refreshed) {
          updateAccount(account.id, { cliKey: result.refreshed.key, cliRefresh: result.refreshed.refresh });
        }
        setSections((prev) => prev.map(s => s.provider === 'grok' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: 'tier' in result ? result.tier : undefined, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'commandcode') {
        const accounts = useCommandCodeStore.getState().accounts;
        const account = manualAccountId ? accounts.find((a) => a.id === manualAccountId) : accounts[0];
        if (!account || !account.apiKey) throw new Error('Command Code is not connected');
        const result = await commandcodeApi.fetchQuota(account.apiKey);
        setSections((prev) => prev.map(s => s.provider === 'commandcode' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, email: result.email, models: result.models, error: result.error
          } : f)
        } : s));
      }
    } catch (err) {
      const msg = (err as Error).message;
      setSections((prev) => prev.map(section => ({
        ...section,
        files: section.files.map(f => f.fileId === fileId ? { ...f, loading: false, error: msg } : f)
      })));
    }
  }, [sections]);

  const loadAuthFiles = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await authFilesApi.list();
      const files: AuthFile[] = Array.isArray(resp) ? resp : (resp as any).items || (resp as any).files || [];

      const grouped: Record<string, FileQuota[]> = {
        antigravity: [], codex: [], kiro: [], copilot: [], anthropic: [], cursor: [], unknown: []
      };

      files.forEach((file) => {
        if (!file) return;
        const providerType = getProviderType(file);
        if (grouped[providerType]) {
          const labelKey = accountLabelKey(file.filename, file.id);
          const customLabel = labelKey ? (useAccountLabelsStore.getState().labels[labelKey] || '').trim() : '';
          grouped[providerType].push({
            fileId: file.id || file.filename || String(Math.random()),
            filename: customLabel || formatFilename(file.filename || file.id || 'unknown'),
            provider: providerType.charAt(0).toUpperCase() + providerType.slice(1),
            providerKey: providerType,
            loading: false,
            email: (file.metadata?.email as string) || (file.account as string) || undefined,
            originalFile: file
          });
        }
      });

      setSections(PROVIDER_DISPLAY.map(p => ({
        provider: p.key,
        displayName: p.name,
        files: grouped[p.key] || [],
      })));

      const goAccounts = useOpenCodeGoStore.getState().accounts.filter(
        (a) => a.apiKey || (a.workspaceId && a.authCookie)
      );
      const goFiles: FileQuota[] = goAccounts.map((a) => {
        const goLabel = (a.label || '').trim();
        return {
          fileId: `opencode-go:${a.id}`,
          filename: goLabel || 'OpenCode Go',
          provider: 'OpenCode Go',
          providerKey: 'opencode-go',
          loading: false,
          email: goLabel || extractWorkspaceId(a.workspaceId) || a.workspaceId || undefined,
        };
      });
      if (goFiles.length > 0) {
        setSections((prev) => prev.map((s) => (s.provider === 'opencode-go' ? { ...s, files: goFiles } : s)));
      }

      const grokAccounts = useXaiStore.getState().accounts.filter((a) => a.apiKey || a.cliKey);
      const grokFiles: FileQuota[] = grokAccounts.map((a) => {
        const grokLabel = (a.label || '').trim();
        return {
          fileId: `grok:${a.id}`,
          filename: grokLabel || 'Grok',
          provider: 'Grok',
          providerKey: 'grok',
          loading: false,
          email: grokLabel || undefined,
        };
      });
      if (grokFiles.length > 0) {
        setSections((prev) => prev.map((s) => (s.provider === 'grok' ? { ...s, files: grokFiles } : s)));
      }

      const ccAccounts = useCommandCodeStore.getState().accounts.filter((a) => a.apiKey);
      const ccFiles: FileQuota[] = ccAccounts.map((a) => {
        const ccLabel = (a.label || '').trim();
        return {
          fileId: `commandcode:${a.id}`,
          filename: ccLabel || 'Command Code',
          provider: 'Command Code',
          providerKey: 'commandcode',
          loading: false,
          email: ccLabel || undefined,
        };
      });
      if (ccFiles.length > 0) {
        setSections((prev) => prev.map((s) => (s.provider === 'commandcode' ? { ...s, files: ccFiles } : s)));
      }

      files.forEach((file) => {
        if (file?.id) {
          setTimeout(() => fetchQuotaForFile(file.id, file), 0);
        }
      });

      for (const f of goFiles) {
        setTimeout(() => fetchQuotaForFile(f.fileId), 0);
      }

      for (const f of grokFiles) {
        setTimeout(() => fetchQuotaForFile(f.fileId), 0);
      }

      for (const f of ccFiles) {
        setTimeout(() => fetchQuotaForFile(f.fileId), 0);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadAuthFiles();
  }, [loadAuthFiles]);

  // Rebuild sections when display labels change elsewhere (e.g. renamed
  // on the Providers page while Quota stays mounted).
  const goAccountsSub = useOpenCodeGoStore((s) => s.accounts);
  const grokAccountsSub = useXaiStore((s) => s.accounts);
  const ccAccountsSub = useCommandCodeStore((s) => s.accounts);
  const oauthLabels = useAccountLabelsStore((s) => s.labels);
  const labelsMounted = useRef(false);
  useEffect(() => {
    if (!labelsMounted.current) {
      labelsMounted.current = true;
      return;
    }
    loadAuthFiles();
  }, [goAccountsSub, grokAccountsSub, ccAccountsSub, oauthLabels, loadAuthFiles]);

  const filterItems: ProviderFilterItem[] = useMemo(() => {
    return sections
      .filter(s => s.files.length > 0)
      .map(s => {
        const iconInfo = ICON_MAP[s.provider] || { needsInvert: false };
        return {
          id: s.provider,
          label: s.displayName,
          count: s.files.length,
          icon: iconInfo.path,
          iconNeedsInvert: iconInfo.needsInvert
        };
      });
  }, [sections]);

  useEffect(() => {
    if (filterItems.length > 0 && !filterItems.some(i => i.id === activeTab)) {
      setActiveTab(filterItems[0].id);
    }
  }, [filterItems, activeTab]);

  const displayedFiles = useMemo(() => {
    const section = sections.find(s => s.provider === activeTab);
    return section ? section.files : [];
  }, [sections, activeTab]);

  const refreshDisplayed = useCallback(() => {
    displayedFiles.forEach(f => fetchQuotaForFile(f.fileId, f.originalFile));
  }, [displayedFiles, fetchQuotaForFile]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => !prev);
  }, []);

  // Publish per-file quota outcomes so the Providers page can show
  // live token state (ok / error) instead of a static "Active".
  useEffect(() => {
    const setHealth = useFileHealthStore.getState().setHealth;
    for (const section of sections) {
      for (const f of section.files) {
        if (f.loading) continue;
        if (f.error) {
          setHealth(f.fileId, { status: 'error', message: f.error });
        } else if ((f.models && f.models.length > 0) || (f.limits && f.limits.length > 0)) {
          setHealth(f.fileId, { status: 'ok' });
        }
      }
    }
  }, [sections]);

  const reload = useCallback(() => {
    loadAuthFiles();
  }, [loadAuthFiles]);

  useEffect(() => {
    const handler = () => loadAuthFiles();
    window.addEventListener('zero-limit:accounts-changed', handler);
    return () => window.removeEventListener('zero-limit:accounts-changed', handler);
  }, [loadAuthFiles]);

  return {
    isAuthenticated,
    sections,
    loading,
    error,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    isPrivacyMode,
    togglePrivacyMode,
    filterItems,
    displayedFiles,
    refreshDisplayed,
    fetchQuotaForFile,
    reload,
  };
}
