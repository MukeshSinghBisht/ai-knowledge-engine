import { LlmProviderName } from '../llm/llm.types';

export type TokenUsageLike = {
  promptTokens: number;
  completionTokens: number;
};

export type CostRates = {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

export type CostEnv = {
  ollamaInput?: string;
  ollamaOutput?: string;
  openaiInput?: string;
  openaiOutput?: string;
  geminiInput?: string;
  geminiOutput?: string;
};

/**
 * Default list prices (USD / 1M tokens).
 * Ollama values are demo assumptions (local is free in reality).
 */
export const DEFAULT_COST_RATES: Record<LlmProviderName, CostRates> = {
  ollama: { inputUsdPer1M: 0.02, outputUsdPer1M: 0.08 },
  openai: { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  gemini: { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
};

export function parseUsdPer1M(
  value: string | undefined,
  fallback: number,
): number {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolveCostRates(
  provider: LlmProviderName,
  env: CostEnv = {},
): CostRates {
  if (provider === 'ollama') {
    return {
      inputUsdPer1M: parseUsdPer1M(
        env.ollamaInput,
        DEFAULT_COST_RATES.ollama.inputUsdPer1M,
      ),
      outputUsdPer1M: parseUsdPer1M(
        env.ollamaOutput,
        DEFAULT_COST_RATES.ollama.outputUsdPer1M,
      ),
    };
  }

  if (provider === 'openai') {
    return {
      inputUsdPer1M: parseUsdPer1M(
        env.openaiInput,
        DEFAULT_COST_RATES.openai.inputUsdPer1M,
      ),
      outputUsdPer1M: parseUsdPer1M(
        env.openaiOutput,
        DEFAULT_COST_RATES.openai.outputUsdPer1M,
      ),
    };
  }

  return {
    inputUsdPer1M: parseUsdPer1M(
      env.geminiInput,
      DEFAULT_COST_RATES.gemini.inputUsdPer1M,
    ),
    outputUsdPer1M: parseUsdPer1M(
      env.geminiOutput,
      DEFAULT_COST_RATES.gemini.outputUsdPer1M,
    ),
  };
}

export function calculateCostUsd(
  usage: TokenUsageLike,
  rates: CostRates,
): number {
  const cost =
    (Math.max(usage.promptTokens, 0) / 1_000_000) * rates.inputUsdPer1M +
    (Math.max(usage.completionTokens, 0) / 1_000_000) * rates.outputUsdPer1M;
  return Math.round(cost * 1e8) / 1e8;
}
