/** JSON Schema for OpenAI / Ollama structured output */
export const DOCUMENT_METADATA_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Short descriptive title for the document',
    },
    language: {
      type: 'string',
      description: 'ISO 639-1 language code, e.g. en, hi, es',
    },
    documentType: {
      type: 'string',
      enum: ['policy', 'faq', 'contract', 'guide', 'other'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '3-6 topical keywords',
    },
    indexable: {
      type: 'boolean',
      description:
        'Whether the document is safe and suitable for search indexing',
    },
    confidence: {
      type: 'number',
      description: 'Confidence score from 0 to 1',
    },
  },
  required: [
    'title',
    'language',
    'documentType',
    'tags',
    'indexable',
    'confidence',
  ],
  additionalProperties: false,
} as const;

export const DOCUMENT_METADATA_SYSTEM_PROMPT = `You extract document metadata for a knowledge base ingestion pipeline.
Analyze the user-provided document text and return metadata only.
Use documentType: policy | faq | contract | guide | other.
Set indexable to false if content looks like credentials, spam, or unusable garbage.
Set confidence between 0 and 1 based on how clear the document is.
Return ONLY a flat JSON object with exactly these root keys: title, language, documentType, tags, indexable, confidence.
Do NOT wrap the answer in a JSON schema. Do NOT nest fields under "properties".`;
