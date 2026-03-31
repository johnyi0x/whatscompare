import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export function utcCalendarDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getClaudeSpendUsd(day: Date): Promise<number> {
  const row = await prisma.claudeDailyUsage.findUnique({ where: { day } });
  return row ? Number(row.estimatedUsd) : 0;
}

export async function recordClaudeSpendUsd(day: Date, deltaUsd: number): Promise<void> {
  if (!Number.isFinite(deltaUsd) || deltaUsd <= 0) return;
  const dec = new Prisma.Decimal(deltaUsd.toFixed(6));
  await prisma.claudeDailyUsage.upsert({
    where: { day },
    create: { day, estimatedUsd: dec },
    update: { estimatedUsd: { increment: dec } },
  });
}

export function dailyBudgetUsd(): number {
  const n = Number(process.env.CLAUDE_DAILY_BUDGET_USD ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function remainingBudgetUsd(spent: number): number {
  return Math.max(0, dailyBudgetUsd() - spent);
}
