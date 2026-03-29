/** Pivot append-only snapshots into Recharts-friendly rows (one row per day, one numeric column per store = that day’s min price for the store). */
export function buildMultiStoreLineSeries(
  snapshots: { recordedAt: Date; store: string; price: unknown }[]
): { storeKeys: string[]; points: Record<string, string | number>[] } {
  const dayStore = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const day = s.recordedAt.toISOString().slice(0, 10);
    if (!dayStore.has(day)) dayStore.set(day, new Map());
    const m = dayStore.get(day)!;
    const p = Number(s.price);
    if (!Number.isFinite(p)) continue;
    const prev = m.get(s.store);
    if (prev == null || p < prev) m.set(s.store, p);
  }
  const days = Array.from(dayStore.keys()).sort();
  const stores = new Set<string>();
  dayStore.forEach((m) => m.forEach((_, k) => stores.add(k)));
  const storeKeys = Array.from(stores).sort();
  const points = days.map((d) => {
    const m = dayStore.get(d)!;
    const row: Record<string, string | number> = { date: d };
    for (const st of storeKeys) {
      const v = m.get(st);
      if (v != null) row[st] = v;
    }
    return row;
  });
  return { storeKeys, points };
}
