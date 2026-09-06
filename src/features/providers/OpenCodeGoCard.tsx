import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { notifyAccountsChanged, useOpenCodeGoStore } from '@/features/providers/opencodeGo.store';
import type { OpenCodeGoAccount } from '@/features/providers/opencodeGo.store';
import { opencodeGoApi, extractWorkspaceId } from '@/services/api/opencodeGo.service';
import { isTauri } from '@/services/tauri';

type Checking = 'auto' | 'manual' | null;

function accountFallback(account: OpenCodeGoAccount): string {
  if (account.label.trim()) return account.label.trim();
  return (
    extractWorkspaceId(account.workspaceId) ||
    account.workspaceId ||
    (account.apiKey ? `••••${account.apiKey.slice(-4)}` : 'OpenCode Go')
  );
}

/**
 * OpenCode Go subscription tracking.
 * Preferred: official usage API with the local opencode-go key
 * (auto-detected from the OpenCode config, desktop app only).
 * Fallback: workspace ID + auth cookie page scrape.
 * Multiple accounts can be connected; each is validated before saving.
 */
export function OpenCodeGoCard() {
  const { t } = useTranslation();
  const { accounts, addAccount, removeAccount, setAccountLabel } = useOpenCodeGoStore();
  const [widInput, setWidInput] = useState('');
  const [cookieInput, setCookieInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [checking, setChecking] = useState<Checking>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = accounts.length > 0;

  const handleAutoDetect = async () => {
    setError(null);
    if (!isTauri()) {
      setError(t('opencodeGo.desktopOnly', 'Auto-detect needs the desktop app. Enter credentials manually below.'));
      return;
    }
    setChecking('auto');
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { join, homeDir } = await import('@tauri-apps/api/path');
      const configPath = await join(await homeDir(), '.local', 'share', 'opencode', 'auth.json');
      const raw = await readTextFile(configPath);
      const data = JSON.parse(raw) as Record<string, { apiKey?: unknown; api_key?: unknown; key?: unknown } | undefined>;
      const entry = data?.['opencode-go'];
      const key = entry?.apiKey ?? entry?.api_key ?? entry?.key;
      if (typeof key !== 'string' || !key) {
        throw new Error(t('opencodeGo.noLocalKey', 'No opencode-go key found in your OpenCode config.'));
      }
      const result = await opencodeGoApi.fetchQuota({ apiKey: key });
      if (result.error || result.models.length === 0) {
        throw new Error(result.error || t('opencodeGo.noData', 'No quota data returned.'));
      }
      addAccount({ label: labelInput.trim(), apiKey: key, workspaceId: '', authCookie: '' });
      setLabelInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleConnect = async () => {
    setError(null);
    const wid = extractWorkspaceId(widInput) || '';
    const cookie = cookieInput.trim();
    if (!wid || !cookie) {
      setError(t('opencodeGo.missingFields', 'Enter both the workspace ID and the auth cookie.'));
      return;
    }
    setChecking('manual');
    try {
      const result = await opencodeGoApi.fetchQuota({ workspaceId: wid, authCookie: cookie });
      if (result.error || result.models.length === 0) {
        setError(result.error || t('opencodeGo.noData', 'No quota data returned. Check your credentials.'));
        return;
      }
      addAccount({ label: labelInput.trim(), apiKey: '', workspaceId: wid, authCookie: cookie });
      setCookieInput('');
      setLabelInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleDisconnect = (id: string) => {
    removeAccount(id);
    setError(null);
    notifyAccountsChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <img src="/opencode-go/opencode-go.svg" alt="OpenCode Go" className="h-8 w-8 shrink-0 object-contain dark:invert" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{t('opencodeGo.title', 'OpenCode Go')}</CardTitle>
            <CardDescription>
              {connected
                ? t('opencodeGo.connected', 'Connected')
                : t('opencodeGo.description', 'Track your OpenCode Go subscription via the official usage API or a workspace ID and auth cookie.')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {accounts.map((account) => (
          <div key={account.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{accountFallback(account)}</span>
              <Button variant="outline" size="sm" onClick={() => handleDisconnect(account.id)}>
                {t('opencodeGo.disconnect', 'Disconnect')}
              </Button>
            </div>
            <Input
              placeholder={t('opencodeGo.labelPlaceholder', 'Display name (optional)')}
              value={account.label}
              onChange={(e) => setAccountLabel(account.id, e.target.value)}
            />
          </div>
        ))}
        <Input
          placeholder={t('opencodeGo.labelPlaceholder', 'Display name (optional)')}
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
        />
        <Button className="w-full" onClick={handleAutoDetect} disabled={checking !== null}>
          {checking === 'auto' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('opencodeGo.autoDetect', 'Auto-detect from OpenCode config')}
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t('opencodeGo.orManual', 'or enter manually')}
          <span className="h-px flex-1 bg-border" />
        </div>
        <Input
          placeholder={t('opencodeGo.workspacePlaceholder', 'Workspace ID (wrk_...) or Go page URL')}
          value={widInput}
          onChange={(e) => setWidInput(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t('opencodeGo.cookiePlaceholder', 'Auth cookie (from opencode.ai, starts with Fe26.2**)')}
          value={cookieInput}
          onChange={(e) => setCookieInput(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t(
            'opencodeGo.cookieHelp',
            'Log in at opencode.ai, open the Go page for your workspace, and copy the auth cookie from browser devtools (Application > Cookies). The cookie expires periodically and will need re-entering.'
          )}
        </p>
        <Button className="w-full" variant="outline" onClick={handleConnect} disabled={checking !== null}>
          {checking === 'manual' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('opencodeGo.connect', 'Connect')}
        </Button>
      </CardContent>
    </Card>
  );
}
