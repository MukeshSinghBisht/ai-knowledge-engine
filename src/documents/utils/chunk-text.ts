/**
 * Minimal Week-3 chunker: normalizes whitespace and slices the text into
 * overlapping windows. Overlap keeps context from being cut mid-idea across
 * chunk boundaries. Week 4 upgrades this (token-aware sizing, PDF, batching).
 */
export function chunkText(text: string, size = 500, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (!clean) {
    return [];
  }

  if (clean.length <= size) {
    return [clean];
  }

  const step = Math.max(1, size - overlap);
  const chunks: string[] = [];

  for (let start = 0; start < clean.length; start += step) {
    chunks.push(clean.slice(start, start + size));

    if (start + size >= clean.length) {
      break;
    }
  }

  return chunks;
}

/** Derive a title from the first non-empty line, capped for the DB column. */
export function deriveTitle(text: string): string {
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine ?? 'Untitled Document').slice(0, 200);
}

/** Format a number[] as a pgvector literal: [0.1,0.2,...] */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
