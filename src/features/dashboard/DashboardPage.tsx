import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Users, Activity, TrendingDown, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/components/ui/chart';
import type { ChartConfig } from '@/shared/components/ui/chart';
import { useDashboardPresenter, formatCompact } from '@/features/dashboard/useDashboardPresenter';

function worstColor(worst: number | null): string {
  if (worst === null) return 'bg-muted';
  if (worst >= 90) return 'bg-red-500';
  if (worst >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function DashboardPage() {
  const { t } = useTranslation();
  const {
    connectionStatus,
    quotaLoading,
    activeAccountsCount,
    loadData,
    providerSummaries,
    attentionItems,
    machineTotals,
    liveTokenRows,
    historyProviders,
    historyPoints,
  } = useDashboardPresenter();

  const historyConfig: ChartConfig = {};
  for (const p of historyProviders) historyConfig[p.key] = { label: p.displayName, color: p.color };
  const historySpan = historyPoints.length > 1
    ? (historyPoints[historyPoints.length - 1].t as number) - (historyPoints[0].t as number)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 p-2"
    >
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('dashboard.hello')}, <span className="text-primary">CK</span>
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.welcomeMessage')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={quotaLoading}
          className="h-8 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${quotaLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('common.refresh', 'Refresh')}</span>
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Accounts Card */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.totalAccounts')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-3xl font-bold text-foreground">
              {connectionStatus === 'connecting' || quotaLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                activeAccountsCount
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.totalAccounts')}
            </p>
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.systemStatus')}</CardTitle>
            <Activity className={`h-4 w-4 ${connectionStatus === 'connected' ? 'text-muted-foreground' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">
               {connectionStatus === 'connecting' ? (
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               ) : connectionStatus === 'connected' ? (
                 t('dashboard.status.operational')
               ) : (
                 t('dashboard.status.offline')
               )}
            </div>
             <p className="text-xs flex items-center gap-1.5 mt-1">
               {connectionStatus === 'connected' ? (
                   <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('dashboard.status.active')}</span>
                    <span className="text-muted-foreground">{t('dashboard.monitoringEnabled')}</span>
                   </>
               ) : (
                    <>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">{t('dashboard.status.error')}</span>
                    <span className="text-muted-foreground">{t('dashboard.checkConnection')}</span>
                   </>
               )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Token Usage Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.tokenUsage')}</h2>

        {/* Machine-wide audit snapshot */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.machineWide')}</CardTitle>
            <span className="text-xs text-muted-foreground">{t('dashboard.auditAsOf')}</span>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {!machineTotals ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                {[
                  { label: t('dashboard.statRequests'), value: formatCompact(machineTotals.requests) },
                  { label: t('dashboard.statCost'), value: `$${machineTotals.cost_usd.toFixed(2)}` },
                  { label: t('dashboard.statInput'), value: formatCompact(machineTotals.tokens_in) },
                  { label: t('dashboard.statOutput'), value: formatCompact(machineTotals.tokens_out) },
                  { label: t('dashboard.statCacheRead'), value: formatCompact(machineTotals.tokens_cache_read) },
                  { label: t('dashboard.statCacheCreate'), value: formatCompact(machineTotals.tokens_creation) },
                  { label: t('dashboard.statSessions'), value: formatCompact(machineTotals.sessions) },
                  { label: t('dashboard.statModels'), value: formatCompact(machineTotals.model_count) },
                ].map((s) => (
                  <div key={s.label} className="p-2 rounded-md bg-background/50 border border-border/50">
                    <div className="text-lg font-bold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {machineTotals && (
              <p className="text-xs text-muted-foreground mt-2">
                {machineTotals.date_first} → {machineTotals.date_last}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Live month-to-date provider totals */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.liveMonthToDate')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {quotaLoading && liveTokenRows.length === 0 ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : liveTokenRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.noLiveUsage')}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {liveTokenRows.map((row) => (
                  <div
                    key={row.fileId}
                    className="flex items-center justify-between p-1.5 rounded-md bg-cyan-500/5 text-xs"
                  >
                    <span className="font-medium text-foreground truncate">
                      {row.label}
                      <span className="ml-2 font-normal text-muted-foreground">{row.displayName}</span>
                    </span>
                    <span className="font-semibold text-foreground shrink-0 ml-2">
                      {row.value}
                      {row.detail && <span className="ml-2 font-normal text-muted-foreground">{row.detail}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quota Overview Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.historyTitle')}</h2>

        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.historySubtitle')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {historyPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.historyEmpty')}</p>
            ) : (
              <div className="rounded-lg bg-card/40 border border-border/50 p-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {historyProviders.map((p) => (
                    <div key={p.key} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 border border-border/50 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                      <span className="font-medium">{p.displayName}</span>
                    </div>
                  ))}
                </div>
                <ChartContainer config={historyConfig} className="h-[260px] w-full">
                  <LineChart
                    accessibilityLayer
                    data={historyPoints}
                    margin={{ left: 12, right: 12, top: 20 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis
                      dataKey="t"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return historySpan < 48 * 3600 * 1000
                          ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      width={44}
                    />
                    <ChartTooltip
                      cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => {
                            if (!value) return '';
                            return new Date(value).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            });
                          }}
                        />
                      }
                    />
                    {historyProviders.map((p) => (
                      <Line
                        key={p.key}
                        dataKey={p.key}
                        type="monotone"
                        stroke={p.color}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="text-2xl font-bold tracking-tight">{t('dashboard.quotaOverview')}</h2>

        {/* Needs Attention */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {t('dashboard.needsAttention')}
            </CardTitle>
            {attentionItems.length > 0 && (
              <span className="text-xs font-semibold text-red-600 dark:text-red-400">{attentionItems.length}</span>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {quotaLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : attentionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t('dashboard.allHealthy')}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {attentionItems.map((item) => (
                  <div
                    key={item.fileId}
                    className="flex items-center justify-between p-1.5 rounded-md bg-red-500/5 text-xs"
                  >
                    <span className="font-medium text-foreground truncate">
                      {item.label}
                      <span className="ml-2 font-normal text-muted-foreground">{item.displayName}</span>
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400 shrink-0 ml-2 truncate max-w-[50%]">
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-provider quota rows */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.byProvider')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-2">
            {quotaLoading && providerSummaries.length === 0 ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-col gap-2.5">
                {providerSummaries.map((p) => (
                  <div key={p.provider} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {p.icon && (
                          <img
                            src={p.icon}
                            alt=""
                            className={`h-4 w-4 ${p.iconNeedsInvert ? 'dark:invert' : ''}`}
                          />
                        )}
                        {p.displayName}
                        <span className="font-normal text-muted-foreground">
                          {t('dashboard.accountsCount', { count: p.accounts })}
                        </span>
                      </span>
                      <span className="font-semibold text-foreground shrink-0 ml-2">
                        {p.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        ) : p.errors > 0 && p.worst === null ? (
                          <span className="text-red-600 dark:text-red-400">
                            {t('dashboard.errorsCount', { count: p.errors })}
                          </span>
                        ) : p.worst !== null ? (
                          `${Math.round(p.worst)}%`
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${worstColor(p.worst)}`}
                        style={{ width: `${p.worst !== null ? Math.min(100, Math.max(0, p.worst)) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {providerSummaries.length === 0 && !quotaLoading && (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noProviders')}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
