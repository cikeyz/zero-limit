import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useOpenCodeGoStore } from '@/features/providers/opencodeGo.store';
import { opencodeGoApi } from '@/services/api/opencodeGo.service';

/**
 * Manual credential card for the OpenCode Go subscription
 * (workspace ID + auth cookie). Unlike OAuth providers this needs
 * no proxy auth file: quota is fetched through the proxy passthrough.
 */
export function OpenCodeGoCard() {
  const { t } = useTranslation();
  const { workspaceId, authCookie, setCredentials, clearCredentials } = useOpenCodeGoStore();
  const [widInput, setWidInput] = useState(workspaceId);
  const [cookieInput, setCookieInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = Boolean(workspaceId && authCookie);

  const handleConnect = async () => {
    setError(null);
    const wid = widInput.trim();
    const cookie = cookieInput.trim();
    if (!wid || !cookie) {
      setError(t('opencodeGo.missingFields', 'Enter both the workspace ID and the auth cookie.'));
      return;
    }
    setChecking(true);
    try {
      const result = await opencodeGoApi.fetchQuota(wid, cookie);
      if (result.error || result.models.length === 0) {
        setError(result.error || t('opencodeGo.noData', 'No quota data returned. Check your credentials.'));
        return;
      }
      setCredentials(wid, cookie);
      setCookieInput('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = () => {
    clearCredentials();
    setWidInput('');
    setCookieInput('');
    setError(null);
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
                ? t('opencodeGo.connectedAs', `Connected workspace ${workspaceId}`)
                : t('opencodeGo.description', 'Track your OpenCode Go subscription with a workspace ID and auth cookie.')}
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
            <Input
              placeholder={t('opencodeGo.workspacePlaceholder', 'Workspace ID (wrk_...)')}
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
            <Button className="w-full" onClick={handleConnect} disabled={checking}>
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('opencodeGo.connect', 'Connect')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
