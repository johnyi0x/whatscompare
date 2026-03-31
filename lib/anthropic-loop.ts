import Anthropic from "@anthropic-ai/sdk";
import {
  addMessageUsage,
  emptyUsageTotals,
  estimateClaudeUsd,
  type UsageTotals,
} from "./claude-usage";

function extractTextBlocks(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
      const t = (block as { text?: string }).text;
      if (t) parts.push(t);
    }
  }
  return parts.join("").trim();
}

export type AnthropicLoopResult = {
  text: string;
  usage: UsageTotals;
  estimatedUsd: number;
};

/**
 * Messages API with server tools; follows `pause_turn` continuations (web search / web fetch).
 */
export async function runAnthropicServerToolLoop(params: {
  system?: string;
  userText: string;
  tools: unknown[];
  maxTokens?: number;
  maxPauseTurns?: number;
}): Promise<AnthropicLoopResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const model = process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-20250514";
  const maxTokens = params.maxTokens ?? 2048;
  const maxPause = params.maxPauseTurns ?? 6;

  const client = new Anthropic({ apiKey: key });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: params.userText }];

  let totals = emptyUsageTotals();
  let lastText = "";
  let pauseCount = 0;

  for (;;) {
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: params.system,
      messages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: params.tools as any,
    });

    totals = addMessageUsage(totals, msg.usage);
    lastText = extractTextBlocks(msg.content);

    if (String(msg.stop_reason) === "pause_turn" && pauseCount < maxPause) {
      pauseCount += 1;
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }

    return {
      text: lastText,
      usage: totals,
      estimatedUsd: estimateClaudeUsd(totals),
    };
  }
}
