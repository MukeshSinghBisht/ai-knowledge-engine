import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
// pdf-parse's debug test-file read only runs when the file is the entry module
// (`!module.parent`). NestJS requires it normally, so the root import is safe.
import pdfParse from 'pdf-parse';

export type SourceType = 'txt' | 'pdf';

const MAX_TEXT_LENGTH = 50000;

/**
 * Turn an uploaded file buffer into plain text we can chunk + embed.
 * Only TXT and PDF are supported; anything else is rejected with a clear error.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ text: string; sourceType: SourceType }> {
  const name = originalName.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || name.endsWith('.pdf');
  const isTxt = mimeType.startsWith('text/') || name.endsWith('.txt');

  let text: string;
  let sourceType: SourceType;

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
    sourceType = 'pdf';
  } else if (isTxt) {
    text = buffer.toString('utf-8');
    sourceType = 'txt';
  } else {
    throw new BadRequestException(
      `Unsupported file type "${mimeType || originalName}". Only .txt and .pdf are supported.`,
    );
  }

  const clean = text.replace(/\s+/g, ' ').trim();

  if (!clean) {
    throw new BadRequestException(
      'No readable text found in the file (is the PDF scanned/image-only?).',
    );
  }

  return { text: clean.slice(0, MAX_TEXT_LENGTH), sourceType };
}

/** Stable fingerprint of a document's text, used to skip duplicate ingestion. */
export function hashContent(text: string): string {
  return createHash('sha256')
    .update(text.replace(/\s+/g, ' ').trim().toLowerCase())
    .digest('hex');
}
