import {
  DEFAULT_FALLBACK_ORDER,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
  parseFallbackOrder,
  parsePositiveInt,
  parseProviderName,
  resolveProviderChain,
} from './fallback-order';
import { TimeoutError, withTimeout } from './with-timeout';

describe('fallback-order', () => {
  it('parses comma-separated order and drops unknowns', () => {
    expect(parseFallbackOrder('openai, gemini, nope, ollama')).toEqual([
      'openai',
      'gemini',
      'ollama',
    ]);
  });

  it('falls back to default order when empty', () => {
    expect(parseFallbackOrder('')).toEqual(DEFAULT_FALLBACK_ORDER);
    expect(parseFallbackOrder(undefined)).toEqual(DEFAULT_FALLBACK_ORDER);
  });

  it('parses a single provider name with fallback', () => {
    expect(parseProviderName('openai')).toBe('openai');
    expect(parseProviderName('nope')).toBe('ollama');
    expect(parseProviderName(undefined, 'gemini')).toBe('gemini');
  });

  it('puts primary first then unique fallbacks, capped by maxAttempts', () => {
    expect(
      resolveProviderChain('gemini', ['openai', 'gemini', 'ollama'], 3),
    ).toEqual(['gemini', 'openai', 'ollama']);
    expect(
      resolveProviderChain('ollama', ['openai', 'gemini', 'ollama'], 2),
    ).toEqual(['ollama', 'openai']);
  });

  it('parses positive ints with fallback', () => {
    expect(parsePositiveInt('10000', DEFAULT_TIMEOUT_MS)).toBe(10000);
    expect(parsePositiveInt('nope', DEFAULT_MAX_ATTEMPTS)).toBe(
      DEFAULT_MAX_ATTEMPTS,
    );
    expect(parsePositiveInt('-1', 5)).toBe(5);
  });
});

describe('withTimeout', () => {
  it('resolves when the promise finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects with TimeoutError when slow', async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve('late'), 80);
    });
    await expect(withTimeout(slow, 20)).rejects.toBeInstanceOf(TimeoutError);
  });
});
