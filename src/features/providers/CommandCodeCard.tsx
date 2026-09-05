import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useCommandCodeStore } from '@/features/providers/commandcode.store';
import { commandcodeApi } from '@/services/api/commandcode.service';
import { notifyAccountsChanged } from '@/features/providers/opencodeGo.store';

/**
 * Manual credential card for Command Code (GOAT and other plans).
 * Uses the CLI API key from ~/.commandcode/auth.json against the
 * internal usage endpoints (whoami, billing/credits, billing/subscriptions).
 */
export function CommandCodeCard() {
  const { t } = useTranslation();
  const { apiKey, setApiKey, clearApiKey } = useCommandCodeStore();
  const [keyInput, setKeyInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = Boolean(apiKey);

  const handleConnect = async () => {
    setError(null);
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
      setApiKey(key);
      setKeyInput('');
      notifyAccountsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = () => {
    clearApiKey();
    setKeyInput('');
    setError(null);
    notifyAccountsChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <img src="/commandcode/commandcode.svg" alt="Command Code" className="h-8 w-8 object-contain" />
          <div>
            <CardTitle className="text-base">{t('commandcode.title', 'Command Code')}</CardTitle>
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
        {connected ? (
          <Button variant="outline" className="w-full" onClick={handleDisconnect}>
            {t('commandcode.disconnect', 'Disconnect')}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
