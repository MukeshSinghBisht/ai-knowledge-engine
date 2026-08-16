import { LlmProviderName } from '../llm/llm.types';

export const SUPPORTED_PROVIDERS: LlmProviderName[] = [
  'ollama',
  'gemini',
  'openai',
];

export const DEFAULT_FALLBACK_ORDER: LlmProviderName[] = [
  'ollama',
  'gemini',
  'openai',
];

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_ATTEMPTS = 3;

export function parseProviderName(
  raw: string | undefined,
  fallback: LlmProviderName = 'ollama',
): LlmProviderName {
  const name = raw?.trim().toLowerCase() as LlmProviderName | undefined;
  return name && SUPPORTED_PROVIDERS.includes(name) ? name : fallback;
}

export function parseFallbackOrder(
  raw: string | undefined,
): LlmProviderName[] {
  if (raw == null || raw.trim() === '') {
    return [...DEFAULT_FALLBACK_ORDER];
  }

  const parsed = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is LlmProviderName =>
      SUPPORTED_PROVIDERS.includes(part as LlmProviderName),
    );

  return parsed.length > 0 ? parsed : [...DEFAULT_FALLBACK_ORDER];
}

/**
 * Primary (LLM_PROVIDER) first, then the rest of FALLBACK_ORDER without duplicates.
 * Capped by maxAttempts.
 */
export function resolveProviderChain(
  primary: LlmProviderName,
  fallbackOrder: LlmProviderName[],
  maxAttempts: number,
): LlmProviderName[] {
  const ordered: LlmProviderName[] = [primary];
  for (const name of fallbackOrder) {
    if (!ordered.includes(name)) {
      ordered.push(name);
    }
  }
  const cap = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 1;
  return ordered.slice(0, cap);
}

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
