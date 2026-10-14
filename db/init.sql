-- Runs once on first container start (empty data dir).
-- Sets up pgvector + the Phase 2 retrieval schema.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL,
  source_type  text NOT NULL DEFAULT 'text',   -- text | txt | pdf
  content_hash text,                            -- sha256 of normalized text, for idempotent re-upload
  owner_id     text,                            -- NULL = shared sample; otherwise visitor session
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Upgrade existing databases and scope duplicate detection to one visitor.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS owner_id text;
DROP INDEX IF EXISTS idx_documents_content_hash;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_owner_content_hash
  ON documents (owner_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents (owner_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  -- Embedding provider is configured to return 768 dimensions.
  embedding   vector(768) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Approximate nearest-neighbour index for cosine similarity search.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks (document_id);

-- AI Gateway 4.1: per-call cost / latency telemetry (same DB as RAG).
DO $$ BEGIN
  CREATE TYPE llm_gateway_operation AS ENUM (
    'generate',
    'tools',
    'embed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE llm_retrieval_mode AS ENUM (
    'simple',
    'thorough'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS llm_gateway_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      text NOT NULL,
  operation       llm_gateway_operation NOT NULL,
  provider        text NOT NULL,
  model           text NOT NULL,
  retrieval_mode  llm_retrieval_mode,
  top_k           int,
  attempt         int NOT NULL DEFAULT 1,
  outcome         text NOT NULL DEFAULT 'success',
  failure_reason  text,
  input_tokens    int NOT NULL DEFAULT 0,
  output_tokens   int NOT NULL DEFAULT 0,
  cost_usd        numeric(14, 8) NOT NULL DEFAULT 0,
  latency_ms      int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_gateway_logs_request_id
  ON llm_gateway_logs (request_id);

CREATE INDEX IF NOT EXISTS idx_llm_gateway_logs_created_at
  ON llm_gateway_logs (created_at);

-- Anonymous demo query quota: 5 questions per browser session, reset after 7 days.
CREATE TABLE IF NOT EXISTS demo_query_usage (
  session_id  text PRIMARY KEY,
  query_count int NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_demo_query_usage_expires_at
  ON demo_query_usage (expires_at);

-- Persistent anonymous demo activity counts; stores no IP addresses or user content.
CREATE TABLE IF NOT EXISTS demo_activity_sessions (
  session_id         text PRIMARY KEY,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  query_submissions  int NOT NULL DEFAULT 0,
  upload_submissions int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_demo_activity_sessions_last_seen_at
  ON demo_activity_sessions (last_seen_at);
