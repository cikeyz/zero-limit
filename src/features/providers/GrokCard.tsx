import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useXaiStore } from '@/features/providers/xai.store';
import { xaiApi } from '@/services/api/xai.service';
import { grokCliApi } from '@/services/api/grokCli.service';
import { notifyAccountsChanged } from '@/features/providers/opencodeGo.store';
import { isTauri } from '@/services/tauri';

/**
 * Grok tracking with two methods:
 * - xAI console API key: API-platform credit balances.
 * - Grok CLI session: free-tier monthly/weekly usage from the CLI
 *   billing endpoints (session key + refresh token from
 *   ~/.grok/auth.json, refreshed automatically on expiry).
 */
export function GrokCard() {
  const { t } = useTranslation();
  const { apiKey, setApiKey, clearApiKey, cliKey, cliRefresh, setCliSession, clearCliSession } = useXaiStore();
  const [keyInput, setKeyInput] = useState('');
  const [cliKeyInput, setCliKeyInput] = useState('');
  const [cliRefreshInput, setCliRefreshInput] = useState('');
  const [checking, setChecking] = useState<'key' | 'cli' | 'auto' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keyConnected = Boolean(apiKey);
  const cliConnected = Boolean(cliKey);

  const connectCliSession = async (key: string, refresh: string) => {
    const result = await grokCliApi.fetchQuota(key, refresh || undefined);
    if (result.error || result.models.length === 0) {
      throw new Error(result.error || t('grok.noCliData', 'No Grok CLI usage returned. Check your session key.'));
    }
    if (result.refreshed) {
      setCliSession(result.refreshed.key, result.refreshed.refresh);
    } else {
      setCliSession(key, refresh);
    }
    setCliKeyInput('');
    setCliRefreshInput('');
    notifyAccountsChanged();
  };

  const handleAutoDetectCli = async () => {
    setError(null);
    if (!isTauri()) {
      setError(t('grok.desktopOnly', 'Auto-detect needs the desktop app. Paste the session key manually below.'));
      return;
    }
    setChecking('auto');
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { join, homeDir } = await import('@tauri-apps/api/path');
      const configPath = await join(await homeDir(), '.grok', 'auth.json');
      const raw = await readTextFile(configPath);
      const data = JSON.parse(raw) as Record<string, { key?: unknown; refresh_token?: unknown } | undefined>;
      let found: { key: string; refresh: string } | null = null;
      for (const entry of Object.values(data || {})) {
        if (entry && typeof entry.key === 'string' && entry.key) {
          found = { key: entry.key, refresh: typeof entry.refresh_token === 'string' ? entry.refresh_token : '' };
          break;
        }
      }
      if (!found) {
        throw new Error(t('grok.noLocalSession', 'No Grok CLI session found. Run grok login first.'));
      }
      await connectCliSession(found.key, found.refresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleConnectKey = async () => {
    setError(null);
    const key = keyInput.trim();
    if (!key) {
      setError(t('grok.missingKey', 'Enter your xAI API key.'));
      return;
    }
    setChecking('key');
    try {
      const result = await xaiApi.fetchQuota(key);
      if (result.error || result.models.length === 0) {
        setError(result.error || t('grok.noData', 'No credit data returned. Check your API key.'));
        return;
      }
      setApiKey(key);
      setKeyInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  const handleConnectCli = async () => {
    setError(null);
    const key = cliKeyInput.trim();
    const refresh = cliRefreshInput.trim();
    if (!key) {
      setError(t('grok.missingCliKey', 'Enter your Grok CLI session key.'));
      return;
    }
    setChecking('cli');
    try {
      await connectCliSession(key, refresh);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <img src="/grok/grok.svg" alt="Grok" className="h-8 w-8 object-contain" />
          <div>
            <CardTitle className="text-base">{t('grok.title', 'Grok (xAI)')}</CardTitle>
            <CardDescription>
              {t('grok.description', 'Track xAI API credits or the free-tier Grok CLI session.')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          <p className="text-sm font-medium">{t('grok.apiKeyMethod', 'xAI console API key')}</p>
          {keyConnected ? (
            <Button variant="outline" className="w-full" onClick={() => { clearApiKey(); notifyAccountsChanged(); }}>
              {t('grok.disconnect', 'Disconnect')}
            </Button>
          ) : (
            <>
              <Input
                type="password"
                placeholder={t('grok.keyPlaceholder', 'xAI API key (xai-...)')}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <Button className="w-full" onClick={handleConnectKey} disabled={checking !== null}>
                {checking === 'key' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('grok.connect', 'Connect')}
              </Button>
            </>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">{t('grok.cliMethod', 'Grok CLI session (free tier)')}</p>
          {cliConnected ? (
            <Button variant="outline" className="w-full" onClick={() => { clearCliSession(); setError(null); notifyAccountsChanged(); }}>
              {t('grok.disconnectCli', 'Disconnect CLI session')}
            </Button>
          ) : (
            <>
              <Button className="w-full" onClick={handleAutoDetectCli} disabled={checking !== null}>
                {checking === 'auto' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('grok.autoDetect', 'Auto-detect from Grok CLI')}
              </Button>
              <Input
                type="password"
                placeholder={t('grok.cliKeyPlaceholder', 'Session key (.key in ~/.grok/auth.json)')}
                value={cliKeyInput}
                onChange={(e) => setCliKeyInput(e.target.value)}
              />
              <Input
                type="password"
                placeholder={t('grok.cliRefreshPlaceholder', 'Refresh token (refresh_token, enables auto-refresh)')}
                value={cliRefreshInput}
                onChange={(e) => setCliRefreshInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  'grok.cliHelp',
                  'Copy .key and .refresh_token from the auth.x.ai entry in ~/.grok/auth.json (created by grok login). Session keys expire after about 7 days; with a refresh token ZeroLimit renews automatically.'
                )}
              </p>
              <Button className="w-full" onClick={handleConnectCli} disabled={checking !== null}>
                {checking === 'cli' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('grok.connectCli', 'Connect CLI session')}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
