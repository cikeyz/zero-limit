import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { notifyAccountsChanged, useOpenCodeGoStore } from '@/features/providers/opencodeGo.store';
import { opencodeGoApi } from '@/services/api/opencodeGo.service';
import { isTauri } from '@/services/tauri';

type Checking = 'auto' | 'manual' | null;

/**
 * OpenCode Go subscription tracking.
 * Preferred: official usage API with the local opencode-go key
 * (auto-detected from the OpenCode config, desktop app only).
 * Fallback: workspace ID + auth cookie page scrape.
 */
export function OpenCodeGoCard() {
  const { t } = useTranslation();
  const { apiKey, workspaceId, authCookie, setApiKey, setCredentials, clearCredentials } = useOpenCodeGoStore();
  const [widInput, setWidInput] = useState(workspaceId);
  const [cookieInput, setCookieInput] = useState('');
  const [checking, setChecking] = useState<Checking>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = Boolean(apiKey || (workspaceId && authCookie));

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
      setApiKey(key);
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleConnect = async () => {
    setError(null);
    const wid = widInput.trim();
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
      setCredentials(wid, cookie);
      setCookieInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleDisconnect = () => {
    clearCredentials();
    setWidInput('');
    setCookieInput('');
    setError(null);
    notifyAccountsChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <img src="/opencode-go/opencode-go.svg" alt="OpenCode Go" className="h-8 w-8 object-contain" />
          <div>
            <CardTitle className="text-base">{t('opencodeGo.title', 'OpenCode Go')}</CardTitle>
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
        {connected ? (
          <Button variant="outline" className="w-full" onClick={handleDisconnect}>
            {t('opencodeGo.disconnect', 'Disconnect')}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
