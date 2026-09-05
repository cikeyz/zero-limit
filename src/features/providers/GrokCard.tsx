import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useXaiStore } from '@/features/providers/xai.store';
import { xaiApi } from '@/services/api/xai.service';

/**
 * Manual credential card for xAI (Grok) API credits.
 * Uses a plain xAI console API key: GET /v1/api-key for credit
 * balances plus rate-limit headers from GET /v1/models.
 * Tracks API-platform credits, not app subscription windows.
 */
export function GrokCard() {
  const { t } = useTranslation();
  const { apiKey, setApiKey, clearApiKey } = useXaiStore();
  const [keyInput, setKeyInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = Boolean(apiKey);

  const handleConnect = async () => {
    setError(null);
    const key = keyInput.trim();
    if (!key) {
      setError(t('grok.missingKey', 'Enter your xAI API key.'));
      return;
    }
    setChecking(true);
    try {
      const result = await xaiApi.fetchQuota(key);
      if (result.error || result.models.length === 0) {
        setError(result.error || t('grok.noData', 'No credit data returned. Check your API key.'));
        return;
      }
      setApiKey(key);
      setKeyInput('');
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
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <img src="/grok/grok.svg" alt="Grok" className="h-8 w-8 object-contain" />
          <div>
            <CardTitle className="text-base">{t('grok.title', 'Grok (xAI)')}</CardTitle>
            <CardDescription>
              {connected
                ? t('grok.connected', 'API key saved')
                : t('grok.description', 'Track xAI API credits with a console API key.')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {connected ? (
          <Button variant="outline" className="w-full" onClick={handleDisconnect}>
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
            <p className="text-xs text-muted-foreground">
              {t(
                'grok.keyHelp',
                'Create a key in the xAI console with model access. This tracks API-platform credit balance, not app subscription windows.'
              )}
            </p>
            <Button className="w-full" onClick={handleConnect} disabled={checking}>
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('grok.connect', 'Connect')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
