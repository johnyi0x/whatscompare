"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const LINE_PALETTE = ["#5cb88a", "#6b9e7d", "#38bdf8", "#a78bfa", "#f472b6", "#fbbf24", "#94a3b8"];

export type BarDatum = { name: string; price: number; isLow: boolean };

type Props = {
  barData: BarDatum[];
  linePoints: Record<string, string | number>[];
  storeKeys: string[];
};

function formatUsd(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function ProductCharts({ barData, linePoints, storeKeys }: Props) {
  if (!barData.length && !linePoints.length) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-surface-subtle px-4 py-8 text-center text-sm text-ink-muted">
        Charts appear after the first successful multi-store sync and a few days of snapshots.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {barData.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">Current prices by store</h3>
          <div className="h-72 w-full rounded-2xl border border-line bg-surface/50 px-2 py-4 dark:bg-surface-subtle/40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-line opacity-40" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${v}`}
                  className="text-[11px]"
                  stroke="var(--color-ink-muted)"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                  stroke="var(--color-ink-muted)"
                />
                <Tooltip
                  formatter={(v: number) => [formatUsd(v), "Price"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(148 163 184 / 0.35)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink)",
                  }}
                />
                <Bar dataKey="price" radius={[0, 8, 8, 0]} maxBarSize={28}>
                  {barData.map((e, i) => (
                    <Cell key={i} fill={e.isLow ? "#5cb88a" : "rgb(148 163 184 / 0.45)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-ink-muted">Lowest price highlighted in mint.</p>
        </section>
      ) : null}

      {linePoints.length > 0 && storeKeys.length > 0 ? (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">Price history (daily low per store)</h3>
          <div className="h-80 w-full rounded-2xl border border-line bg-surface/50 px-2 py-4 dark:bg-surface-subtle/40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={linePoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-line opacity-40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-ink-muted)" />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-ink-muted)"
                  width={56}
                />
                <Tooltip
                  formatter={(v: number) => [formatUsd(v), ""]}
                  labelFormatter={(l) => l}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgb(148 163 184 / 0.35)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink)",
                  }}
                />
                {storeKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={LINE_PALETTE[i % LINE_PALETTE.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
    </div>
  );
}
