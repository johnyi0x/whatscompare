/** Roll up Anthropic message `usage` objects (including multi-turn `pause_turn`). */

export type UsageTotals = {
  input_tokens: number;
  output_tokens: number;
  web_search_requests: number;
  web_fetch_requests: number;
};

export function emptyUsageTotals(): UsageTotals {
  return { input_tokens: 0, output_tokens: 0, web_search_requests: 0, web_fetch_requests: 0 };
}

export function addMessageUsage(acc: UsageTotals, raw: unknown): UsageTotals {
  if (!raw || typeof raw !== "object") return acc;
  const u = raw as Record<string, unknown>;
  const st = u.server_tool_use;
  let ws = 0;
  let wf = 0;
  if (st && typeof st === "object") {
    const o = st as Record<string, unknown>;
    ws = Number(o.web_search_requests ?? 0) || 0;
    wf = Number(o.web_fetch_requests ?? 0) || 0;
  }
  return {
    input_tokens: acc.input_tokens + (Number(u.input_tokens) || 0),
    output_tokens: acc.output_tokens + (Number(u.output_tokens) || 0),
    web_search_requests: acc.web_search_requests + ws,
    web_fetch_requests: acc.web_fetch_requests + wf,
  };
}

/**
 * Token $/MTok from env; web search $/request (Anthropic list: $10 / 1k searches = $0.01 each).
 * Web fetch: no per-request surcharge in current Anthropic pricing — cost is token-only (already in usage).
 */
export function estimateClaudeUsd(totals: UsageTotals): number {
  const inPerMt = Number(process.env.CLAUDE_INPUT_USD_PER_MT ?? 3);
  const outPerMt = Number(process.env.CLAUDE_OUTPUT_USD_PER_MT ?? 15);
  const perSearch = Number(process.env.CLAUDE_WEB_SEARCH_USD_EACH ?? 0.01);
  const tok =
    (totals.input_tokens / 1e6) * (Number.isFinite(inPerMt) ? inPerMt : 3) +
    (totals.output_tokens / 1e6) * (Number.isFinite(outPerMt) ? outPerMt : 15);
  const searches =
    totals.web_search_requests * (Number.isFinite(perSearch) ? perSearch : 0.01);
  return tok + searches;
}
