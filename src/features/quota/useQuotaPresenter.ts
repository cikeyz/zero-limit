import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { authFilesApi } from '@/services/api/auth.service';
import { quotaApi } from '@/services/api/quota.service';
import type { AuthFile, FileQuota, ProviderSection } from '@/types';
import type { ProviderFilterItem } from '@/features/quota/components/ProviderFilter';
import { resolveCodexChatgptAccountId, resolveCodexPlanType, resolveGeminiCliProjectId } from '@/shared/utils/quota.helpers';
import { useOpenCodeGoStore } from '@/features/providers/opencodeGo.store';
import { opencodeGoApi } from '@/services/api/opencodeGo.service';
import { useXaiStore } from '@/features/providers/xai.store';
import { xaiApi } from '@/services/api/xai.service';
import { grokCliApi } from '@/services/api/grokCli.service';
import { useCommandCodeStore } from '@/features/providers/commandcode.store';
import { commandcodeApi } from '@/services/api/commandcode.service';

function getProviderType(file: AuthFile): 'antigravity' | 'codex' | 'gemini-cli' | 'kiro' | 'copilot' | 'anthropic' | 'cursor' | 'opencode-go' | 'grok' | 'commandcode' | 'unknown' {
  const filename = (file?.filename || file?.id || '').toLowerCase();

  if (filename.startsWith('antigravity-') || filename.includes('antigravity')) return 'antigravity';
  if (filename.startsWith('codex-') || filename.includes('codex')) return 'codex';
  if (filename.startsWith('gemini-cli-') || filename.includes('gemini')) return 'gemini-cli';
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
  if (provider.includes('gemini')) return 'gemini-cli';
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

const ICON_MAP: Record<string, { path?: string; needsInvert: boolean }> = {
  antigravity: { path: '/antigravity/antigravity.svg', needsInvert: true },
  codex: { path: '/openai/openai.svg', needsInvert: true },
  'gemini-cli': { path: '/gemini/gemini.png', needsInvert: false },
  kiro: { path: '/kiro/kiro.png', needsInvert: false },
  copilot: { path: '/copilot/copilot.png', needsInvert: true },
  anthropic: { path: '/claude/claude.png', needsInvert: false },
  cursor: { path: '/cursor/cursor.svg', needsInvert: true },
  'opencode-go': { path: '/opencode-go/opencode-go.svg', needsInvert: true },
  grok: { path: '/grok/grok.svg', needsInvert: true },
  commandcode: { path: '/commandcode/commandcode.svg', needsInvert: false },
};

const PROVIDER_DISPLAY: { key: string; name: string }[] = [
  { key: 'antigravity', name: 'Antigravity' },
  { key: 'anthropic', name: 'Claude (Anthropic)' },
  { key: 'codex', name: 'Codex' },
  { key: 'commandcode', name: 'Command Code' },
  { key: 'cursor', name: 'Cursor' },
  { key: 'gemini-cli', name: 'Gemini CLI' },
  { key: 'copilot', name: 'GitHub Copilot' },
  { key: 'grok', name: 'Grok (xAI)' },
  { key: 'kiro', name: 'Kiro (CodeWhisperer)' },
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
    if (fileId === 'opencode-go' || maybeQuota?.providerKey === 'opencode-go') {
      targetProvider = 'opencode-go';
    } else if (fileId === 'grok' || maybeQuota?.providerKey === 'grok') {
      targetProvider = 'grok';
    } else if (fileId === 'commandcode' || maybeQuota?.providerKey === 'commandcode') {
      targetProvider = 'commandcode';
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

      } else if (targetProvider === 'gemini-cli') {
        const projectId = resolveGeminiCliProjectId(file);
        if (!projectId) throw new Error('Project ID not found in file');
        const result = await quotaApi.fetchGeminiCli(authIndex, projectId);

        setSections((prev) => prev.map(s => s.provider === 'gemini-cli' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f,
            loading: false,
            models: result.buckets.map(b => ({
              name: b.modelId, percentage: b.percentage, resetTime: b.resetTime, used: b.used ?? true
            })),
            error: result.error
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
        const { apiKey, workspaceId, authCookie } = useOpenCodeGoStore.getState();
        if (!apiKey && (!workspaceId || !authCookie)) throw new Error('OpenCode Go is not connected');
        const result = await opencodeGoApi.fetchQuota({ apiKey, workspaceId, authCookie });
        setSections((prev) => prev.map(s => s.provider === 'opencode-go' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'grok') {
        const { apiKey, cliKey, cliRefresh, setCliSession } = useXaiStore.getState();
        const result = cliKey
          ? await grokCliApi.fetchQuota(cliKey, cliRefresh || undefined)
          : await xaiApi.fetchQuota(apiKey);
        if (cliKey && 'refreshed' in result && result.refreshed) {
          setCliSession(result.refreshed.key, result.refreshed.refresh);
        }
        setSections((prev) => prev.map(s => s.provider === 'grok' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: 'tier' in result ? result.tier : undefined, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'commandcode') {
        const { apiKey } = useCommandCodeStore.getState();
        if (!apiKey) throw new Error('Command Code is not connected');
        const result = await commandcodeApi.fetchQuota(apiKey);
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
        antigravity: [], codex: [], 'gemini-cli': [], kiro: [], copilot: [], anthropic: [], cursor: [], unknown: []
      };

      files.forEach((file) => {
        if (!file) return;
        const providerType = getProviderType(file);
        if (grouped[providerType]) {
          grouped[providerType].push({
            fileId: file.id || file.filename || String(Math.random()),
            filename: formatFilename(file.filename || file.id || 'unknown'),
            provider: providerType.charAt(0).toUpperCase() + providerType.slice(1),
            providerKey: providerType,
            loading: false,
            originalFile: file
          });
        }
      });

      setSections(PROVIDER_DISPLAY.map(p => ({
        provider: p.key,
        displayName: p.name,
        files: grouped[p.key] || [],
      })));

      const { apiKey: goApiKey, workspaceId: goWorkspaceId, authCookie: goAuthCookie } = useOpenCodeGoStore.getState();
      const goConnected = Boolean(goApiKey || (goWorkspaceId && goAuthCookie));
      if (goConnected) {
        const goFile: FileQuota = {
          fileId: 'opencode-go',
          filename: 'OpenCode Go',
          provider: 'OpenCode Go',
          providerKey: 'opencode-go',
          loading: false,
        };
        setSections((prev) => prev.map((s) => (s.provider === 'opencode-go' ? { ...s, files: [goFile] } : s)));
      }

      const { apiKey: xaiApiKey, cliKey: grokCliKey } = useXaiStore.getState();
      const grokConnected = Boolean(xaiApiKey || grokCliKey);
      if (grokConnected) {
        const grokFile: FileQuota = {
          fileId: 'grok',
          filename: 'Grok',
          provider: 'Grok',
          providerKey: 'grok',
          loading: false,
        };
        setSections((prev) => prev.map((s) => (s.provider === 'grok' ? { ...s, files: [grokFile] } : s)));
      }

      const { apiKey: commandcodeApiKey } = useCommandCodeStore.getState();
      const commandcodeConnected = Boolean(commandcodeApiKey);
      if (commandcodeConnected) {
        const ccFile: FileQuota = {
          fileId: 'commandcode',
          filename: 'Command Code',
          provider: 'Command Code',
          providerKey: 'commandcode',
          loading: false,
        };
        setSections((prev) => prev.map((s) => (s.provider === 'commandcode' ? { ...s, files: [ccFile] } : s)));
      }

      files.forEach((file) => {
        if (file?.id) {
          setTimeout(() => fetchQuotaForFile(file.id, file), 0);
        }
      });

      if (goConnected) {
        setTimeout(() => fetchQuotaForFile('opencode-go'), 0);
      }

      if (grokConnected) {
        setTimeout(() => fetchQuotaForFile('grok'), 0);
      }

      if (commandcodeConnected) {
        setTimeout(() => fetchQuotaForFile('commandcode'), 0);
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
