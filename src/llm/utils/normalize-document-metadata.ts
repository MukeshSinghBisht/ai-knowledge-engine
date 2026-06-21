const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'en',
  hindi: 'hi',
  spanish: 'es',
  french: 'fr',
  german: 'de',
};

const DOCUMENT_TYPES = new Set([
  'policy',
  'faq',
  'contract',
  'guide',
  'other',
]);

function stripQuotes(value: string): string {
  return value.replace(/^["']+|["']+$/g, '').trim();
}

function flattenMetadataShape(parsed: Record<string, unknown>): Record<string, unknown> {
  const props = parsed.properties;

  if (parsed.type === 'object' && props && typeof props === 'object') {
    const flat: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(
      props as Record<string, unknown>,
    )) {
      const normalizedKey = key.replace(/^\(|\)$/g, '');
      flat[normalizedKey] = value;
    }

    for (const field of [
      'title',
      'language',
      'documentType',
      'tags',
      'indexable',
      'confidence',
    ]) {
      if (parsed[field] !== undefined) {
        flat[field] = parsed[field];
      }
    }

    return flat;
  }

  return parsed;
}

function normalizeLanguage(value: unknown): string {
  if (typeof value !== 'string') {
    return 'en';
  }

  const trimmed = stripQuotes(value);
  const lower = trimmed.toLowerCase();

  if (LANGUAGE_ALIASES[lower]) {
    return LANGUAGE_ALIASES[lower];
  }

  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return 'en';
}

function normalizeDocumentType(value: unknown): string {
  if (typeof value !== 'string') {
    return 'other';
  }

  const normalized = stripQuotes(value).toLowerCase();

  return DOCUMENT_TYPES.has(normalized) ? normalized : 'other';
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => stripQuotes(tag))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => stripQuotes(tag))
      .filter(Boolean);
  }

  return [];
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return clampConfidence(parsed);
    }
    return 0.5;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampConfidence(value);
  }

  return 0.5;
}

function clampConfidence(value: number): number {
  const normalized = value > 1 ? value / 100 : value;

  if (normalized < 0) {
    return 0;
  }

  if (normalized > 1) {
    return 1;
  }

  return normalized;
}

function normalizeTitle(value: unknown, fallbackText?: string): string {
  if (typeof value === 'string') {
    const title = stripQuotes(value);
    if (title.length > 0) {
      return title.slice(0, 200);
    }
  }

  if (fallbackText) {
    const firstLine = fallbackText
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);

    if (firstLine) {
      return firstLine.slice(0, 200);
    }
  }

  return 'Untitled Document';
}

/** Coerce common LLM metadata quirks into a flat shape for DTO validation. */
export function normalizeDocumentMetadata(
  parsed: unknown,
  fallbackText?: string,
): Record<string, unknown> {
  if (!parsed || typeof parsed !== 'object') {
    return {
      title: normalizeTitle(undefined, fallbackText),
      language: 'en',
      documentType: 'other',
      tags: [],
      indexable: false,
      confidence: 0.5,
    };
  }

  const flat = flattenMetadataShape(parsed as Record<string, unknown>);

  return {
    title: normalizeTitle(flat.title, fallbackText),
    language: normalizeLanguage(flat.language),
    documentType: normalizeDocumentType(flat.documentType),
    tags: normalizeTags(flat.tags),
    indexable: normalizeBoolean(flat.indexable),
    confidence: normalizeConfidence(flat.confidence),
  };
}
