-- Runs once on first container start (empty data dir).
-- Sets up pgvector + the Phase 2 retrieval schema.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  source_type  text NOT NULL DEFAULT 'text',   -- text | txt | pdf
  content_hash text,                            -- sha256 of normalized text, for idempotent re-upload
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Same content ingested twice is a no-op (idempotency, FR-ING-06).
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash
  ON documents (content_hash);

CREATE TABLE IF NOT EXISTS document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  -- 768 dims = nomic-embed-text (Ollama). Must match the embedding model.
  embedding   vector(768) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Approximate nearest-neighbour index for cosine similarity search.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks (document_id);
