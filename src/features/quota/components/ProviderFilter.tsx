
import { motion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';

export interface ProviderFilterItem {
  id: string;
  label: string;
  count: number;
  icon?: string;
  iconNeedsInvert?: boolean;
}

interface ProviderFilterProps {
  items: ProviderFilterItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function ProviderFilter({ items, activeId, onSelect }: ProviderFilterProps) {
  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
      {items.map((item) => {
        const isActive = activeId === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={isActive ? undefined : item.label}
            className={cn(
              "relative flex min-w-fit items-center gap-2 rounded-lg border px-4 py-2.5 transition-colors duration-200",
              isActive
                ? "border-transparent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="provider-active-pill"
                className="absolute inset-0 rounded-lg border border-primary/50 bg-accent shadow-lg shadow-primary/10"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <span className="relative z-10 flex min-w-fit items-center gap-2">
            {item.icon && (
               <img
                 src={item.icon}
                 alt={item.label}
                 className={cn("h-4 w-4 object-contain", item.iconNeedsInvert && "invert-on-dark")}
               />
            )}

            {(isActive || !item.icon) && (
              <span className="text-sm font-medium">{item.label}</span>
            )}

            {(isActive || !item.icon) && item.count > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 h-5 min-w-[1.25rem] justify-center px-1",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.count}
              </Badge>
            )}

            {isActive && (
                <div className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500"></div>
            )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
