/**
 * Compact Quota Card for Grid View
 */

import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Clock, RefreshCw, Eye, List, ChevronDown, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { maskEmail } from '@/shared/utils/privacy';
import type { QuotaModel } from '@/types';


interface CompactQuotaCardProps {
  fileId: string;
  filename: string;
  provider: string;
  email?: string;
  loading: boolean;
  error?: string;
  items: QuotaModel[];
  plan?: string;
  isCurrent?: boolean;
  onRefresh: () => void;
  isPrivacyMode: boolean;
}

export function CompactQuotaCard({
  email,
  filename,
  loading,
  error,
  items,
  plan,
  onRefresh,
  isPrivacyMode
}: CompactQuotaCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  // Check if account is suspended
  const isSuspended = plan?.toLowerCase() === 'suspended';

  // Apply masking
  const displayEmail = isPrivacyMode ? maskEmail(email || '********@*****.com') : (email || filename || '');

  // Group items by model type (for Antigravity) or show as-is (for Codex limits)
  const groupedItems = useMemo(() => {
    const groups: Record<string, QuotaModel[]> = {};

    items.forEach(item => {
      const name = item.name.toLowerCase();
      let groupName: string;

      // Codex limits - show each with its own name (no grouping)
      if (name.includes('hour') || name.includes('weekly') || name.includes('review') || name.includes('limit')) {
        groupName = item.name; // Use original name as group name
      }
      // Antigravity models - group by type
      else if (name.includes('gemini') && name.includes('pro')) groupName = 'G3 Pro';
      else if (name.includes('gemini') && name.includes('flash')) groupName = 'G3 Flash';
      else if (name.includes('gemini') && name.includes('image')) groupName = 'G3 Image';
      else if (name.includes('claude')) groupName = 'Claude';
      else if (name.includes('gemini')) groupName = 'Gemini';
      else groupName = item.name; // Default: use original name

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });

    return Object.entries(groups).map(([name, groupItems]) => {
      const total = groupItems.reduce((sum, i) => sum + i.percentage, 0);
      const avg = Math.round(total / groupItems.length);
      const resetTime = groupItems.find(i => i.resetTime)?.resetTime;
      const sortOrder = groupItems.reduce((min, i) => Math.min(min, i.sortOrder ?? 99), 99);

      return { name, percentage: avg, used: groupItems.some(i => i.used), resetTime, sortOrder, items: groupItems };
    }).sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
  }, [items]);

  const getProgressColor = (pct: number) => {
    if (pct > 50) return 'bg-green-500';
    if (pct > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPercentColor = (pct: number) => {
    if (pct > 50) return 'text-green-600';
    if (pct > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow h-full flex flex-col gap-0">
      {/* Email with expand/collapse toggle */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            {isExpanded ? (
              <List className="h-4 w-4 text-green-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <span className="font-semibold text-sm truncate" title={isPrivacyMode ? undefined : email}>{displayEmail}</span>
        </div>
      </div>



      {/* Error state */}
      {error && !loading && (
        <div className="text-xs text-destructive truncate">{error}</div>
      )}

      {/* Suspended State - centered icon and text */}
      {!loading && !error && isSuspended && (
        <div className="flex flex-col items-center justify-center py-6 gap-2 flex-1">
          <Ban className="h-10 w-10 text-yellow-500" />
          <span className="text-sm font-semibold text-yellow-600">Temporarily Suspended</span>
        </div>
      )}

      {/* Model badges grid with progress bars - expanded view */}
      {!loading && !error && !isSuspended && isExpanded && (
        <div className="grid grid-cols-1 gap-2 flex-1">
          {groupedItems.filter(g => !g.items.every(i => i.separate)).map((group, idx) => (
            <div key={idx} className="space-y-1">
              {/* Model info row */}
              <div className="flex items-center gap-1 text-xs min-w-0">
                <span className="text-muted-foreground font-medium truncate flex-1" title={group.name}>{group.name}</span>
                {group.resetTime && (
                  <span className="flex items-center gap-0.5 text-muted-foreground text-[10px] flex-shrink-0">
                    <Clock className="h-3 w-3 text-orange-400" />
                    {group.resetTime}
                  </span>
                )}
                <span className={`font-bold flex-shrink-0 ${getPercentColor(group.used ? 100 - group.percentage : group.percentage)}`}>
                  {group.percentage}{group.used ? '% used' : '%'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(group.used ? 100 - group.percentage : group.percentage)}`}
                  style={{ width: `${group.percentage}%` }}
                />
              </div>
            </div>
          ))}
          {groupedItems.filter(g => g.items.length > 0 && g.items.every(i => i.separate)).map((group, idx) => (
            <div key={`burn-${idx}`} className="space-y-1 border-t pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('quotaCard.totalBurn', 'Total burn')}
              </div>
              {group.items.map((item, itemIdx) => (
                <div key={itemIdx}>
                  {item.displayValue ? (
                    <div className="text-xl font-bold tracking-tight">{item.displayValue}</div>
                  ) : (
                    <div className="text-xl font-bold tracking-tight">{item.percentage}{item.used ? '% used' : '%'}</div>
                  )}
                  {(item.detail || item.resetTime) && !item.separate && (
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {item.detail && <span>{item.detail}</span>}
                      {item.resetTime && <span>Resets {item.resetTime}</span>}
                    </div>
                  )}
                  {item.separate && item.detail && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      <span>{item.detail}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Collapsed compact summary view - simple inline text */}
      {!loading && !error && !isSuspended && !isExpanded && (
        <div className="text-xs text-muted-foreground space-y-1">
          {groupedItems.filter(g => !g.items.every(i => i.separate)).map((group, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-medium truncate flex-1" title={group.name}>{group.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`font-bold ${getPercentColor(group.used ? 100 - group.percentage : group.percentage)}`}>
                  {group.percentage}{group.used ? '% used' : '%'}
                </span>
                {group.resetTime && (
                  <span className="flex items-center gap-0.5 text-[10px]">
                    <Clock className="h-2.5 w-2.5" />
                    {group.resetTime}
                  </span>
                )}
              </div>
            </div>
          ))}
          {groupedItems.filter(g => g.items.length > 0 && g.items.every(i => i.separate)).map((group, idx) => (
            <div key={`burn-${idx}`} className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-medium truncate flex-1" title={group.name}>{group.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {group.items[0]?.displayValue && (
                  <span className="font-bold text-sm">{group.items[0].displayValue}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Row */}
      <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground mt-auto">
        <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <div className="flex items-center gap-1">
          {/* View Details Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="View details"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <span>Quota Details</span>
                  <Badge variant="secondary" className="font-mono font-normal text-sm px-2">
                    {displayEmail}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {groupedItems.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <Badge variant="outline" className="ml-auto">
                        {group.items.length} models
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.items.map((item, idx) => (
                        <div key={idx} className="rounded-lg border bg-card p-3 space-y-2">
                          {item.separate && item.displayValue ? (
                            <>
                            <div className="text-2xl font-bold tracking-tight">{item.displayValue}</div>
                            {item.detail && (
                              <div className="text-xs text-muted-foreground">{item.detail}</div>
                            )}
                            </>
                          ) : (
                            <>
                            <div className="text-xs text-muted-foreground truncate" title={item.name}>{item.name}</div>
                            <div className="flex items-center justify-between">
                            <span className={`font-bold text-sm ${getPercentColor(item.used ? 100 - item.percentage : item.percentage)}`}>
                              {item.percentage}{item.used ? '% used' : '%'}
                            </span>
                            </div>
                            </>
                          )}
                          {item.displayValue && !item.separate && (
                            <div className="text-xs text-muted-foreground">
                              {item.displayValue}
                            </div>
                          )}
                          {!item.separate && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                              <div
                                className={`h-full rounded-full ${getProgressColor(item.used ? 100 - item.percentage : item.percentage)}`}
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                          )}
                          {item.resetTime && !item.separate && (
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

          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </Card>
  );
}
