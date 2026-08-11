import {
  calculateCostUsd,
  parseUsdPer1M,
  resolveCostRates,
} from './llm-cost';

describe('llm-cost', () => {
  it('uses assumed Ollama token rates (same pattern as cloud)', () => {
    const rates = resolveCostRates('ollama');
    // 1M in + 1M out → 0.02 + 0.08
    expect(
      calculateCostUsd(
        { promptTokens: 1_000_000, completionTokens: 1_000_000 },
        rates,
      ),
    ).toBe(0.1);
  });

  it('applies Ollama env overrides', () => {
    const rates = resolveCostRates('ollama', {
      ollamaInput: '0.05',
      ollamaOutput: '0.1',
    });
    expect(
      calculateCostUsd(
        { promptTokens: 500_000, completionTokens: 500_000 },
        rates,
      ),
    ).toBe(0.075);
  });

  it('uses OpenAI defaults when env is empty', () => {
    const rates = resolveCostRates('openai');
    // 1M in + 1M out → 0.15 + 0.60
    expect(
      calculateCostUsd(
        { promptTokens: 1_000_000, completionTokens: 1_000_000 },
        rates,
      ),
    ).toBe(0.75);
  });

  it('applies Gemini env overrides', () => {
    const rates = resolveCostRates('gemini', {
      geminiInput: '0.1',
      geminiOutput: '0.4',
    });
    expect(
      calculateCostUsd(
        { promptTokens: 500_000, completionTokens: 250_000 },
        rates,
      ),
    ).toBe(0.15);
  });

  it('falls back when env values are invalid', () => {
    expect(parseUsdPer1M('nope', 0.15)).toBe(0.15);
    expect(parseUsdPer1M('-1', 0.15)).toBe(0.15);
    expect(parseUsdPer1M('', 0.15)).toBe(0.15);
  });
});
