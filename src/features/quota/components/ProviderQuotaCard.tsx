import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { RefreshCw, User, Clock, Search, Folder, List, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { useMemo } from 'react';
import { maskEmail, maskFolder } from '@/shared/utils/privacy';
import type { QuotaModel } from '@/types';


interface ProviderQuotaCardProps {
  fileId: string;
  filename: string;
  provider: string;
  email?: string;
  loading: boolean;
  error?: string;
  items: QuotaModel[];
  plan?: string;
  onRefresh: () => void;
  isPrivacyMode: boolean;
}

export function ProviderQuotaCard({
  filename,
  provider,
  email,
  loading,
  error,
  items,
  plan,
  onRefresh,
  isPrivacyMode
}: ProviderQuotaCardProps) {
  const { t } = useTranslation();

  const displayEmail = isPrivacyMode ? maskEmail(email || '') : (email || '********@*****.com');
  const displayFilename = isPrivacyMode ? maskFolder(filename) : filename;

  const groupedItems = useMemo(() => {
    const groups: Record<string, QuotaModel[]> = {};
    const isAntigravity = provider.toLowerCase().includes('antigravity');
    const lowerProvider = provider.toLowerCase();
    const providerId = lowerProvider.replace(/[\s-]+/g, '');

    const resolveIcon = (groupName: string): { icon: string | undefined; needsInvert: boolean } => {
      const lowerName = groupName.toLowerCase();
      let icon: string | undefined;

      if (lowerName.includes('claude')) {
        icon = '/claude/claude.png';
      } else if (lowerName.includes('gemini')) {
        icon = '/gemini/gemini.png';
      } else if (lowerName.includes('gpt') || lowerName.includes('o1')) {
        icon = '/openai/openai.svg';
      } else if (lowerName === 'other' || !icon) {
        if (lowerProvider.includes('antigravity')) {
          icon = '/antigravity/antigravity.svg';
        } else if (lowerProvider.includes('codex')) {
          icon = '/openai/openai.svg';
        } else if (lowerProvider.includes('kiro')) {
          icon = '/kiro/kiro.png';
        } else if (lowerProvider.includes('copilot') || lowerProvider.includes('github')) {
          icon = '/copilot/copilot.png';
        } else if (lowerProvider.includes('cursor')) {
          icon = '/cursor/cursor.svg';
        } else if (lowerProvider.includes('opencode')) {
          icon = '/opencode-go/opencode-go.svg';
        } else if (lowerProvider.includes('grok') || lowerProvider.includes('xai')) {
          icon = '/grok/grok.svg';
        } else if (providerId.includes('commandcode')) {
          icon = '/commandcode/commandcode.svg';
        } else {
          icon = '/openai/openai.png'; // Default fallback
        }
      }

      const needsInvert = ['/copilot/copilot.png', '/cursor/cursor.svg', '/opencode-go/opencode-go.svg', '/grok/grok.svg', '/antigravity/antigravity.svg', '/openai/openai.svg'].includes(icon);
      return { icon, needsInvert };
    };

    // Standalone totals (e.g. token counts) render as their own trailing groups.
    const standalone = items.filter(i => i.separate);

    items.filter(i => !i.separate).forEach(item => {
      const name = item.name.toLowerCase();
      let groupName = 'Other';

      if (name.includes('claude')) groupName = 'Claude';
      else if (name.includes('gemini') && name.includes('pro')) groupName = 'Gemini Pro';
      else if (name.includes('gemini') && name.includes('flash')) groupName = 'Gemini Flash';
      else if (name.includes('gemini')) groupName = 'Gemini';
      else if (!isAntigravity) {
        if (name.includes('gpt-4')) groupName = 'GPT-4';
        else if (name.includes('gpt-3.5')) groupName = 'GPT-3.5';
        else if (name.includes('gpt') || name.includes('o1')) groupName = 'GPT';
      }

      // Ungrouped models collect under their provider instead of a generic bucket.
      if (groupName === 'Other') groupName = provider;

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    const main = Object.entries(groups).map(([name, groupItems]) => {
      const total = groupItems.reduce((sum, i) => sum + i.percentage, 0);
      const avg = Math.round(total / groupItems.length);
      const resetTime = groupItems.find(i => i.resetTime)?.resetTime;
      const used = groupItems.some(i => i.used);
      const sortOrder = groupItems.reduce((min, i) => Math.min(min, i.sortOrder ?? 99), 99);
      const { icon, needsInvert } = resolveIcon(name);

      return {
        name,
        percentage: avg,
        used,
        items: groupItems,
        resetTime,
        sortOrder,
        icon,
        needsInvert
      };
    }).sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

    for (const item of standalone) {
      const { icon, needsInvert } = resolveIcon(item.name);
      main.push({
        name: item.name,
        percentage: item.percentage,
        used: item.used ?? false,
        items: [item],
        resetTime: item.resetTime,
        icon,
        needsInvert
      });
    }

    return main;
  }, [items, provider]);

  // Check if account is suspended
  const isSuspended = plan?.toLowerCase() === 'suspended';

  return (
    <Card className="mb-4 overflow-hidden border bg-card text-card-foreground p-0 py-0 gap-1">
      {/* Header Section */}
      <div className="flex flex-col gap-2 border-b p-2 pb-2 pt-3 bg-muted/20">
        <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
                 {/* Top Row: List Icon + Email */}
                 <div className="flex items-center gap-3">
                    <List className="h-4 w-4 text-green-500" />
                    <span className="font-bold text-lg tracking-tight">{displayEmail}</span>
                 </div>

                 {/* Bottom Row: Badges */}
                 <div className="flex items-center gap-2">
                    {/* Provider Badge */}
                    <Badge variant="secondary" className="flex items-center gap-1.5 px-2 py-0.5 font-normal rounded-md">
                        <User className="h-3.5 w-3.5" />
                        <span>{provider}</span>
                    </Badge>

                    {/* Filename/Project Badge */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                         <Folder className="h-3.5 w-3.5" />
                         <span>{displayFilename}</span>
                    </div>
                 </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                    disabled={loading}
                >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    {t('common.refresh')}
                </Button>

                <Dialog>
                    <DialogTrigger asChild>
                         <Button variant="outline" size="sm" className="h-8 text-xs">
                            <Search className="mr-2 h-3.5 w-3.5" />
                            Details
                         </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-3xl lg:max-w-4xl max-h-[85vh] overflow-y-auto no-scrollbar w-full border-border/50">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-xl">
                                <span>Quota Details</span>
                                <Badge variant="secondary" className="font-mono font-normal text-sm px-2">
                                    {displayEmail}
                                </Badge>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 mt-4">
                            {groupedItems.map((group, groupIdx) => (
                                <div key={groupIdx} className="space-y-3">
                                    <div className="flex items-center gap-2 border-b pb-2">
                                        {group.icon ? (
                                            <img src={group.icon} className={`h-5 w-5 opacity-80 ${group.needsInvert ? 'dark:invert' : ''}`} alt={group.name} />
                                        ) : (
                                            <div className="h-5 w-5" />
                                        )}
                                        <h3 className="font-semibold text-lg">{group.name}</h3>
                                        <Badge variant="outline" className="ml-auto">
                                            {group.items.length} models
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.items.map((item, idx) => (
                                            <div key={idx} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-sm truncate max-w-[180px]" title={item.name}>
                                                        {item.name}
                                                    </span>
                                                    <span className={`font-bold text-sm ${item.used ? (item.percentage < 80 ? 'text-green-500' : 'text-yellow-500') : (item.percentage > 20 ? 'text-green-500' : 'text-yellow-500')}`}>
                                                        {item.percentage}{item.used ? '% used' : '%'}
                                                    </span>
                                                </div>
                                                {item.displayValue && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.displayValue}
                                                    </div>
                                                )}
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                                    <div
                                                        className={`h-full rounded-full ${item.used ? (item.percentage < 80 ? 'bg-green-500' : 'bg-yellow-500') : (item.percentage > 20 ? 'bg-green-500' : 'bg-yellow-500')}`}
                                                        style={{ width: `${item.percentage}%` }}
                                                    />
                                                </div>
                                                {item.resetTime && (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        <span>Reset: {item.resetTime}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
      </div>

      {/* Summary Content Section */}
      <CardContent className="px-2 py-1 space-y-2">
        {error ? (
            <div className="py-2 text-sm text-destructive flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-destructive"></div>
                {error}
            </div>
        ) : (
            <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    {t('quotaCard.usage')}
                </div>

                {groupedItems.length === 0 && !loading && !isSuspended && (
                    <div className="text-sm italic text-muted-foreground">{t('quotaCard.noUsage')}</div>
                )}

                {/* Suspended State */}
                {isSuspended && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Ban className="h-12 w-12 text-yellow-500" />
                    <span className="text-lg font-semibold text-yellow-600">Temporarily Suspended</span>
                  </div>
                )}

                {!isSuspended && groupedItems.map((group, idx) => (
                    <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                {group.icon ? (
                                    <img src={group.icon} className={`h-4 w-4 opacity-80 ${group.needsInvert ? 'dark:invert' : ''}`} alt={group.name} />
                                ) : (
                                    <div className="h-4 w-4" />
                                )}
                                <span className="font-medium text-foreground">{group.name}</span>
                                <span className="text-xs text-muted-foreground">({group.items.length} models)</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className={`font-bold ${group.used ? (group.percentage < 80 ? 'text-green-500' : 'text-yellow-500') : (group.percentage > 20 ? 'text-green-500' : 'text-yellow-500')}`}>
                                    {group.percentage}% {group.used ? 'used' : 'left'}
                                </span>
                                {group.resetTime && (
                                    <div className="flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{group.resetTime}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${group.used ? (group.percentage < 80 ? 'bg-green-500' : 'bg-yellow-500') : (group.percentage > 20 ? 'bg-green-500' : 'bg-yellow-500')}`}
                                style={{ width: `${group.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
