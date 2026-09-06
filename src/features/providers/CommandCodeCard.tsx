import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { ConnectedAccountRow } from '@/features/providers/ConnectedAccountRow';
import { useCommandCodeStore } from '@/features/providers/commandcode.store';
import type { CommandCodeAccount } from '@/features/providers/commandcode.store';
import { commandcodeApi } from '@/services/api/commandcode.service';
import { notifyAccountsChanged } from '@/features/providers/opencodeGo.store';
import { isTauri } from '@/services/tauri';

function accountFallback(account: CommandCodeAccount): string {
  if (account.label.trim()) return account.label.trim();
  if (account.apiKey) return `••••${account.apiKey.slice(-4)}`;
  return 'Command Code';
}

/**
 * Manual credential card for Command Code (GOAT and other plans).
 * Uses the CLI API key from ~/.commandcode/auth.json against the
 * internal usage endpoints (whoami, billing/credits, billing/subscriptions).
 * Multiple accounts can be connected; each is validated before saving.
 */
export function CommandCodeCard() {
  const { t } = useTranslation();
  const { accounts, addAccount, removeAccount, setAccountLabel } = useCommandCodeStore();
  const [labelInput, setLabelInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = accounts.length > 0;

  const handleAutoDetect = async () => {
    setError(null);
    if (!isTauri()) {
      setError(t('commandcode.desktopOnly', 'Auto-detect needs the desktop app. Enter the key manually below.'));
      return;
    }
    setChecking(true);
    try {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { join, homeDir } = await import('@tauri-apps/api/path');
      const raw = await readTextFile(await join(await homeDir(), '.commandcode', 'auth.json'));
      const data = JSON.parse(raw) as { apiKey?: unknown };
      if (typeof data?.apiKey !== 'string' || !data.apiKey) {
        throw new Error(t('commandcode.noLocalKey', 'No API key found in your Command Code auth file. Run cmd login first.'));
      }
      const result = await commandcodeApi.fetchQuota(data.apiKey);
      if (result.error || result.models.length === 0) {
        throw new Error(result.error || t('commandcode.noData', 'No usage data returned. Check your API key.'));
      }
      addAccount({ label: labelInput.trim(), apiKey: data.apiKey });
      setLabelInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {    setError(null);
    const key = keyInput.trim();
    if (!key) {
      setError(t('commandcode.missingKey', 'Enter your Command Code API key.'));
      return;
    }
    setChecking(true);
    try {
      const result = await commandcodeApi.fetchQuota(key);
      if (result.error || result.models.length === 0) {
        setError(result.error || t('commandcode.noData', 'No usage data returned. Check your API key.'));
        return;
      }
      addAccount({ label: labelInput.trim(), apiKey: key });
      setKeyInput('');
      setLabelInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
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
          <img src="/commandcode/commandcode.svg" alt="Command Code" className="h-8 w-8 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{t('commandcode.title', 'Command Code')}</CardTitle>
            <CardDescription>
              {connected
                ? t('commandcode.connected', 'API key saved')
                : t('commandcode.description', 'Track Command Code credits and rolling windows with your CLI API key.')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {accounts.map((account) => (
          <ConnectedAccountRow
            key={account.id}
            fallback={accountFallback(account)}
            label={account.label}
            labelPlaceholder={t('commandcode.labelPlaceholder', 'Display name (optional)')}
            disconnectLabel={t('commandcode.disconnect', 'Disconnect')}
            onDisconnect={() => handleDisconnect(account.id)}
            onLabel={(value) => setAccountLabel(account.id, value)}
          />
        ))}
        <Input
          placeholder={t('commandcode.labelPlaceholder', 'Display name (optional)')}
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
        />
        <Button className="w-full" variant="outline" onClick={handleAutoDetect} disabled={checking}>
          {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('commandcode.autoDetect', 'Auto-detect from Command Code CLI')}
        </Button>
        <Input
          type="password"
          placeholder={t('commandcode.keyPlaceholder', 'API key from ~/.commandcode/auth.json')}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t(
            'commandcode.keyHelp',
            'Find it in the apiKey field of ~/.commandcode/auth.json (created by cmd login). Shows monthly credits plus live 5-hour and weekly windows.'
          )}
        </p>
        <Button className="w-full" onClick={handleConnect} disabled={checking}>
          {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('commandcode.connect', 'Connect')}
        </Button>
      </CardContent>
    </Card>
  );
}
