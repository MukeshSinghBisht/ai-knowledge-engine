/**
 * Generates the demo PDF used to show off the RAG engine ("ask the AI about itself").
 * Run:  node demo/generate-handbook.js
 * Output: demo/ai-knowledge-engine-handbook.pdf
 */
const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

const OUT = path.join(__dirname, 'ai-knowledge-engine-handbook.pdf');

// Each section: a heading plus one or more paragraphs. Facts are concrete on
// purpose so demo answers are verifiable, and synonyms are sprinkled in so
// semantic search visibly beats keyword matching.
const SECTIONS = [
  {
    heading: '1. Overview',
    body: [
      'The AI Knowledge Engine is a backend service that lets a team ask plain-English questions and get answers drawn only from its own documents. It is built with NestJS and TypeScript. The project was created as a hands-on way to learn production Retrieval-Augmented Generation, and it doubles as a portfolio piece.',
      'The core promise is simple: the system never invents facts. Every answer is grounded in stored content, and the exact source passages are returned alongside the answer so a reader can audit where it came from.',
    ],
  },
  {
    heading: '2. The Problem It Solves',
    body: [
      'Large language models are confident but forgetful. Ask a raw model about your company policies and it will happily make something up, because it has never seen your data. This behaviour is called hallucination.',
      'Retrieval-Augmented Generation fixes this by fetching the most relevant passages from a trusted knowledge base first, then asking the model to answer using only those passages. The result is an assistant that is accurate, current, and traceable to a source.',
    ],
  },
  {
    heading: '3. Architecture at a Glance',
    body: [
      'Requests arrive at a NestJS HTTP layer organised into feature modules: chat, documents, query, health, and a shared llm module. Postgres with the pgvector extension stores documents and their vector embeddings. Ollama runs the language and embedding models locally, so development costs nothing and no data leaves the machine.',
      'The design keeps ingestion (turning documents into searchable vectors) cleanly separate from querying (answering a question). This separation makes each part easy to test and reason about.',
    ],
  },
  {
    heading: '4. Language Model Providers',
    body: [
      'The engine talks to language models through a single provider interface, so the underlying vendor can be swapped without touching business logic. Three providers are supported: Ollama, Google Gemini, and OpenAI. The active provider is chosen with the LLM_PROVIDER environment variable and defaults to Ollama.',
      'Ollama is the default because it is free, local, and private. Gemini and OpenAI are available for higher-quality answers when an API key is supplied. This vendor-neutral approach avoids lock-in and lets the team compare models on the same task.',
    ],
  },
  {
    heading: '5. The Embedding Model',
    body: [
      'An embedding is a list of numbers that captures the meaning of a piece of text. Texts with similar meaning end up close together in this numeric space, which is what makes semantic search possible.',
      'This project uses the nomic-embed-text model served by Ollama, which produces vectors of 768 dimensions. The same model must be used for both storing documents and searching, because vectors from different models are not comparable. The chosen dimension, 768, is fixed in the database column definition.',
    ],
  },
  {
    heading: '6. Chunking Strategy',
    body: [
      'Whole documents are too large to embed usefully, so each document is split into smaller overlapping pieces called chunks. Small chunks embed with sharper meaning, and the overlap prevents an idea from being cut in half at a boundary.',
      'The current chunker uses a sliding window of roughly five hundred characters with about one hundred characters of overlap between neighbours. A future improvement is token-aware sizing, which measures length in model tokens rather than raw characters.',
    ],
  },
  {
    heading: '7. Vector Storage and Search',
    body: [
      'Each chunk and its embedding are stored in Postgres using the pgvector extension, which adds a native vector column type. Similarity between a question and a chunk is measured with cosine distance; a smaller distance means a closer meaning, and the score returned to the caller is one minus that distance.',
      'To keep search fast as data grows, an HNSW index is built over the embedding column using cosine operators. HNSW is an approximate nearest-neighbour index, trading a tiny amount of accuracy for a large gain in speed.',
    ],
  },
  {
    heading: '8. Document Ingestion',
    body: [
      'Documents enter the system in two ways. Raw text can be posted directly as JSON, or a file can be uploaded. File upload accepts plain text and PDF files up to ten megabytes; PDFs are parsed to text before chunking. Both paths share the same downstream pipeline of chunk, embed, and store.',
      'Ingestion is idempotent. A SHA-256 hash of the normalised text is stored with a unique constraint, so uploading identical content a second time is a no-op: the existing document is returned and nothing is embedded again. Unsupported file types, empty files, and image-only scanned PDFs are rejected with a clear error.',
    ],
  },
  {
    heading: '9. The Query Flow (RAG)',
    body: [
      'Answering a question follows three steps: retrieve, augment, and generate. First the question is embedded and the top matching chunks are retrieved. Then those chunks are inserted into the prompt as numbered sources. Finally the language model writes an answer using only that supplied context.',
      'The response includes the written answer, the list of source chunks with their similarity scores, a grounded flag, and token usage counts. Returning the sources is what makes the answer auditable rather than a black box.',
    ],
  },
  {
    heading: '10. Grounding and Guardrails',
    body: [
      'The system prompt instructs the model to answer strictly from the provided sources and to say it does not know when the answer is absent. This is the guardrail that stops the assistant from falling back on general world knowledge.',
      'For example, if the knowledge base only contains store policies and someone asks who painted the Mona Lisa, the correct behaviour is to decline, because that fact is not in the documents even though the model happens to know it.',
    ],
  },
  {
    heading: '11. Optional Tool Calling',
    body: [
      'Beyond retrieval, the engine includes a small demonstration of tool or function calling. Two example tools are exposed to the model: one returns the current date and one counts the exact number of words in a piece of text.',
      'When a tool is needed the model requests it, the backend runs the real function, and the result is fed back so the model can finish its answer. A safety limit of five rounds prevents runaway loops. Basic retrieval does not need tools; they matter for more advanced agentic behaviour where the model decides when to act.',
    ],
  },
  {
    heading: '12. Data Model',
    body: [
      'Two main tables hold the knowledge base. The documents table records the title, the full original content, the source type of text, txt, or pdf, and the content hash used for deduplication. The document_chunks table holds each chunk, its position within the document, and its 768-dimension embedding vector.',
      'Chunks reference their parent document and are removed automatically if the parent is deleted, keeping the store consistent.',
    ],
  },
  {
    heading: '13. Roadmap and Phases',
    body: [
      'The project is delivered in phases. Phase one covered the chat foundation, structured output, and the tool-calling demo. Phase two added pgvector storage and semantic search. Phase three delivered grounded question answering and file upload with deduplication.',
      'Later phases are planned. Phase four introduces asynchronous ingestion using a BullMQ job queue, response caching with Redis, and per-user rate limiting. Phase five adds streaming responses so answers appear token by token. Phase six adds multi-tenant authentication with JSON Web Tokens and a full audit trail. Multi-tenant isolation and authentication are not implemented yet; they are scheduled for phase six.',
    ],
  },
  {
    heading: '14. Non-Functional Qualities',
    body: [
      'Reliability matters as much as features. Provider or configuration errors return a 503 Service Unavailable, invalid model output returns a 502 Bad Gateway, and bad input returns a 400 Bad Request. Requests are validated against typed schemas before any work begins.',
      'Because the default setup runs entirely on a local machine with Ollama and a Postgres container, sensitive documents never leave the developer environment, which is a strong privacy guarantee during development.',
    ],
  },
  {
    heading: '15. Glossary',
    body: [
      'Embedding: a numeric vector representing the meaning of text. Chunk: a small overlapping slice of a document. Cosine similarity: a measure of how close two vectors point in the same direction. Grounding: restricting answers to retrieved context. Idempotency: repeating an operation has no additional effect. HNSW: an approximate nearest-neighbour index used for fast vector search.',
    ],
  },
];

function build() {
  const doc = new PDFDocument({ size: 'A4', margin: 64 });
  doc.pipe(fs.createWriteStream(OUT));

  // Cover
  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .text('AI Knowledge Engine', { align: 'left' });
  doc
    .moveDown(0.3)
    .font('Helvetica')
    .fontSize(14)
    .fillColor('#555')
    .text('Technical & Product Handbook', { align: 'left' });
  doc
    .moveDown(0.5)
    .fontSize(10)
    .fillColor('#888')
    .text(
      'A retrieval-augmented generation service built with NestJS, pgvector, and Ollama.',
    );
  doc.moveDown(1).fillColor('#000');

  SECTIONS.forEach((section) => {
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).text(section.heading);
    doc.moveDown(0.3);
    section.body.forEach((para) => {
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111')
        .text(para, { align: 'justify', lineGap: 2 });
      doc.moveDown(0.4);
    });
  });

  doc.end();
  return OUT;
}

build();
console.log('Wrote', OUT);
