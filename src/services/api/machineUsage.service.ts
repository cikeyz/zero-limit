export interface MachineUsageTotals {
  sessions: number;
  messages: number;
  requests: number;
  tokens_in: number;
  tokens_out: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  tokens_creation: number;
  tokens_reasoning: number;
  cost_usd: number;
  harness_count: number;
  model_count: number;
  date_first: string;
  date_last: string;
}

export interface MachineUsageSnapshot {
  exportedAt: string;
  totals: MachineUsageTotals | null;
}

let cache: MachineUsageSnapshot | null | undefined;

export async function getMachineUsage(): Promise<MachineUsageSnapshot | null> {
  if (cache !== undefined) return cache;
  try {
    const res = await fetch('machine-usage.json');
    if (!res.ok) {
      cache = null;
      return cache;
    }
    cache = (await res.json()) as MachineUsageSnapshot;
    return cache;
  } catch {
    cache = null;
    return cache;
  }
}
