import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

interface ConnectedAccountRowProps {
  fallback: string;
  method?: string;
  label: string;
  labelPlaceholder: string;
  disconnectLabel: string;
  onDisconnect: () => void;
  onLabel: (value: string) => void;
}

export function ConnectedAccountRow({
  fallback,
  method,
  label,
  labelPlaceholder,
  disconnectLabel,
  onDisconnect,
  onLabel,
}: ConnectedAccountRowProps) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fallback}</p>
          {method && <p className="text-xs text-muted-foreground">{method}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect}>
          {disconnectLabel}
        </Button>
      </div>
      <Input placeholder={labelPlaceholder} value={label} onChange={(e) => onLabel(e.target.value)} />
    </div>
  );
}
