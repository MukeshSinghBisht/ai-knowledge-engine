# Business Requirements Document — AI Knowledge Engine

> A reference spec for the project. Sections are numbered and requirements are tagged
> with IDs (e.g. `FR-RAG-03`) so we can cite them from commits, PRs, and while building.

---

## 1. Document control

| Field | Value |
|-------|-------|
| Project | AI Knowledge Engine (`ai-knowledge-engine`) |
| Author | Mukesh Bisht |
| Status | Living document — updated per phase |
| Version | 0.6 (Phase 3: RAG `/query` + file upload/dedup + wipe endpoint; demo runbook added) |
| Related | `ai-backend-engineer-roadmap/ROADMAP.md`, `ROADMAP` CHECKLIST, `docs/interview-notes.md` |

**How to use this doc:** Before building a feature, open the matching requirement
section (e.g. Week 3 work → §7.3 Retrieval). Each functional requirement has an ID,
a priority, and acceptance criteria you can turn into tests.

---

## 2. Executive summary

The AI Knowledge Engine is a **multi-tenant Retrieval-Augmented Generation (RAG) API**.
Users upload documents; the system chunks, embeds, and stores them; and answers
natural-language questions using only the content of those documents, with source
citations.

It is a **backend engineering** project (NestJS, PostgreSQL/pgvector, Redis, BullMQ,
SSE, JWT) that happens to use LLMs — not an ML/model-training project. It doubles as a
**portfolio + interview artifact**: every phase must produce a working slice and a
matching set of interview notes.

---

## 3. Business context & objectives

### 3.1 Problem
Organizations have knowledge locked in documents (policies, FAQs, contracts, guides).
Employees and customers can't get fast, trustworthy answers without reading everything.
Generic LLMs hallucinate and don't know private/internal content.

### 3.2 Solution
A RAG API that answers questions **grounded in the organization's own documents**, with
citations, tenant isolation, and production-grade ingestion/caching.

### 3.3 Objectives (measurable)
| ID | Objective |
|----|-----------|
| OBJ-1 | Answer document questions grounded in retrieved context, with sources. |
| OBJ-2 | Keep tenants fully isolated (tenant A never sees tenant B data). |
| OBJ-3 | Ingest large documents asynchronously without blocking the API. |
| OBJ-4 | Stream answers for a responsive UX. |
| OBJ-5 | Be demonstrable and explainable (README, diagram, demo video, interview notes). |

### 3.4 Non-goals
Training/fine-tuning models, building a full frontend product, non-text media (audio/
image) understanding, and real-time collaborative editing are **out of scope**.

---

## 4. Stakeholders & personas

| Persona | Description | Needs |
|---------|-------------|-------|
| **Builder / Developer** (primary) | You — building for skills + portfolio | Clear phased scope, testable slices |
| **End user (tenant member)** | Uploads docs, asks questions | Accurate, cited answers; fast responses |
| **Tenant admin** | Manages a tenant's users/docs | Isolation, control over what's indexed |
| **Interviewer / reviewer** | Evaluates the project | Clear architecture, tradeoff reasoning |
| **Ops (future)** | Runs the system | Observability, safe failure modes |

---

## 5. Scope

### 5.1 In scope
- Provider-agnostic LLM layer (Ollama / Gemini / OpenAI).
- Chat, structured extraction, RAG query, semantic search.
- PDF/TXT ingestion with chunking + embeddings in pgvector.
- Async ingestion (BullMQ + Redis), response caching, rate limiting.
- SSE streaming responses.
- JWT auth, multi-tenant isolation, audit logging.

### 5.2 Out of scope (v1)
- Fine-tuning / training models.
- Non-text documents (images, audio, video).
- Full production frontend (a minimal demo web client is optional in Phase 5).
- Enterprise SSO/SAML, billing, admin dashboards.

### 5.3 Assumptions
- Local dev uses **Ollama** (free) by default; cloud providers are swappable via config.
- Embedding model and dimension are fixed per environment and must match between
  ingest and query (see §9.3).
- Single-region, single Postgres instance for v1.

### 5.4 Constraints
- Part-time build (~14–16 hrs/week); **cut scope, not interview prep** if behind.
- Never skip the three signature capabilities: multi-tenant, async queue, streaming.
- API costs controlled via small dev docs + caching (Phase 4).

---

## 6. System overview

### 6.1 High-level flow
```text
Upload:  document -> (async) chunk -> embed -> store vectors (pgvector)
Query:   question -> embed -> vector search top-k -> build context
         -> LLM answer grounded in context -> stream reply + citations
```

### 6.2 Component map
| Layer | Responsibility | Tech |
|-------|----------------|------|
| API | HTTP endpoints, validation, auth | NestJS controllers + DTOs |
| Service | Orchestration (RAG, ingestion) | NestJS services |
| LLM | Provider-agnostic chat/embeddings | `LlmService` + providers |
| Vector store | Chunks + embeddings + search | Postgres + pgvector |
| Queue | Async ingestion jobs | BullMQ + Redis |
| Cache | LLM/response caching | Redis |
| Auth | JWT, tenant scoping | `@nestjs/jwt`, guards |
| Audit | Track key actions | `audit_events` table |

### 6.3 Design principles
- **Provider-agnostic:** all providers implement one interface; swap via `LLM_PROVIDER`.
- **Backend owns retrieval:** the LLM reads context we give it (basic RAG is not agentic).
- **Validate in and out:** DTO validation on input; validate/normalize LLM output.
- **Fail safe:** guard external loops (max rounds/retries); clear error codes.

---

## 7. Functional requirements

> Priority: **M** = Must, **S** = Should, **C** = Could. Each maps to a roadmap phase.

### 7.1 LLM foundation (Phase 1 — DONE)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-CHAT-01 | M | `POST /chat` returns an LLM reply with token usage | 201 with `reply`, `model`, `provider`, `usage` |
| FR-CHAT-02 | M | Input validated via DTO | Extra/invalid fields → 400 |
| FR-CHAT-03 | M | Provider selectable via `LLM_PROVIDER` | ollama/gemini/openai all return same `ChatResult` shape |
| FR-CHAT-04 | M | `POST /chat/structured` returns validated document metadata | 201 with normalized `metadata`; invalid LLM JSON → 502 |
| FR-CHAT-05 | M | LLM output normalized before validation | Nested/`properties`, `"English"`, string booleans, %-confidence coerced |
| FR-CHAT-06 | S | Retry structured extraction once on validation failure | 2 attempts before 502 |
| FR-TOOL-01 | C | (Optional) Tool/function calling demo | **DONE (Ollama).** `POST /chat/tools` with `getCurrentDate` + `countWords`; model triggers backend functions via a max-5-round loop; `toolsUsed` reported. Gemini/OpenAI stubbed. Not required for basic RAG — built for learning/interview coverage. |

### 7.2 Vector storage & schema (Phase 2, Week 3)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-DB-01 | M | Docker Compose brings up Postgres + pgvector | **DONE.** `pgvector/pgvector:pg16` in `docker-compose.yml`; `db/init.sql` creates the `vector` extension. Host port 5433 (5432 taken by native Postgres on dev machine). |
| FR-DB-02 | M | `documents` and `document_chunks` tables exist | **DONE.** Created by `db/init.sql`; TypeORM entities map them (`synchronize: false`). |
| FR-DB-03 | M | Chunk embeddings stored in a `vector(n)` column | **DONE.** `embedding vector(768)` (nomic-embed-text); written via raw `$n::vector` SQL. |
| FR-DB-04 | S | Vector index for similarity (IVFFlat/HNSW) | **DONE.** HNSW index with `vector_cosine_ops`. |

### 7.3 Retrieval / semantic search (Phase 2, Week 3–4)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-RAG-01 | M | Generate embeddings via the LLM layer | **DONE.** `LlmService.embed()` → Ollama `nomic-embed-text`; same model for ingest + query. |
| FR-RAG-02 | M | `POST /search` returns top-k chunks with scores | **DONE.** Cosine similarity (`1 - (embedding <=> query)`), ranked, `topK` (default 5, max 50). |
| FR-RAG-03 | M | Search returns chunk metadata | **DONE.** Returns chunkId, documentId, title, chunkIndex, content, score. |
| FR-RAG-04 | S | `page`/`pageSize` (default 1/10, cap 100) on list-style results | Pending — search uses `topK`; page/pageSize when a list endpoint is added. |

### 7.4 Ingestion (Phase 2 Week 4 → Phase 3)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-ING-01 | M | `POST /documents` ingests raw text | **DONE (basic).** Stores document + chunks synchronously. Async is Phase 4. |
| FR-ING-02 | M | Chunking with overlap | **DONE (basic).** Char-based sliding window (size 500, overlap 100). Later: token-aware sizing. |
| FR-ING-03 | M | Batch embed + persist chunks | **DONE (sequential).** Each chunk embedded and inserted. Later: true batching. |
| FR-ING-04 | M | PDF + TXT upload with extraction | **DONE.** `POST /documents/upload` (multipart, max 10 MB); `pdf-parse` for PDF, utf-8 for TXT; shares the same chunk/embed/store path. |
| FR-ING-05 | S | Reject invalid rows/files with clear errors | **DONE.** Unsupported type / empty / image-only PDF → 400 with a clear message. |
| FR-ING-06 | S | Idempotency on duplicate document hash | **DONE.** `content_hash` (sha256 of normalized text) with a unique index; re-upload returns the existing doc as `duplicate: true` and embeds nothing. |

### 7.5 RAG generation (Phase 3, Week 5–6)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-GEN-01 | M | `POST /query` retrieves context then answers | **DONE.** Retrieves top-k (default 4), stuffs chunks into a grounded prompt, LLM answers. |
| FR-GEN-02 | M | Answer includes source citations | **DONE.** Returns `sources[]` (chunkId, documentId, title, chunkIndex, content, score) + `grounded` flag. |
| FR-GEN-03 | M | "Don't know" behavior | **DONE.** System prompt forbids outside knowledge; verified returns "I don't know based on the available documents." |
| FR-GEN-04 | S | Log prompt, chunks used, latency | Pending — Phase 4 observability. |

### 7.6 Production engineering (Phase 4, Week 7–8)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-JOB-01 | M | Async ingestion via BullMQ queue + worker | Upload enqueues job; worker processes |
| FR-JOB-02 | M | Upload returns a job id immediately | Non-blocking response |
| FR-JOB-03 | M | `GET /jobs/:id` returns job status | pending/active/completed/failed |
| FR-JOB-04 | S | Retry with backoff on failure | Job survives worker restart |
| FR-CACHE-01 | S | Cache LLM responses (exact match) | Hash(prompt+context) hit returns cached answer |
| FR-CACHE-02 | C | Semantic cache | Similar query above threshold returns cached answer |
| FR-RATE-01 | S | Per-user rate limiting | Requests over limit → 429 |

### 7.7 Streaming (Phase 5, Week 9–10)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-STR-01 | M | SSE streaming chat endpoint | Tokens flushed incrementally |
| FR-STR-02 | M | Streaming RAG (sources then streamed answer) | Sources sent first, answer streamed |
| FR-STR-03 | C | Minimal web client | EventSource demo (optional) |

### 7.8 Enterprise / multi-tenant (Phase 6, Week 11–12)
| ID | Priority | Requirement | Acceptance criteria |
|----|----------|-------------|---------------------|
| FR-AUTH-01 | M | JWT register/login | Token issued; protected routes require it |
| FR-TEN-01 | M | `tenant_id` on all tenant-scoped tables | Schema enforces scoping |
| FR-TEN-02 | M | Repository layer filters by tenant | Every query scoped to caller's tenant |
| FR-TEN-03 | M | Tenant isolation test | Automated test: tenant A cannot read tenant B docs |
| FR-AUD-01 | M | Audit log for search, upload, auth | `audit_events` captures who/when/action/target |
| FR-SEC-01 | S | Hardened input validation | File size/type limits, timeouts |
| FR-DOC-01 | M | Swagger/OpenAPI for all endpoints | `/docs` documents every route |

---

## 8. Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-PERF-01 | Performance | Log p95 query latency; retrieval + answer within a reasonable interactive budget |
| NFR-SCALE-01 | Scalability | Ingestion offloaded to workers; API stays responsive under upload load |
| NFR-REL-01 | Reliability | Ingestion survives worker restart (BullMQ retry/backoff) |
| NFR-SEC-01 | Security | Secrets only in env; no secrets committed; JWT-protected routes |
| NFR-SEC-02 | Security | Tenant isolation enforced at the data-access layer, not just UI |
| NFR-OBS-01 | Observability | Structured logs for prompts, chunks used, latency, job outcomes |
| NFR-MAINT-01 | Maintainability | Provider-agnostic interfaces; DTO validation; typed contracts |
| NFR-COST-01 | Cost | Caching + small dev docs to control LLM API spend |
| NFR-PORT-01 | Portability | `docker compose up` brings up the full stack locally |
| NFR-DOC-01 | Documentation | README + architecture diagram + interview notes kept current |

---

## 9. Data model

> Finalized per phase; this is the target shape.

### 9.1 `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid / bigint PK | |
| tenant_id | uuid | FR-TEN-01 (added Phase 6, plan for it early) |
| title | text | |
| source_type | text | `pdf` \| `txt` \| `text` |
| content_hash | text | idempotency (FR-ING-06) |
| created_at | timestamptz | |

### 9.2 `document_chunks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid / bigint PK | |
| document_id | fk → documents | |
| tenant_id | uuid | denormalized for scoped search |
| chunk_index | int | order within document |
| content | text | chunk text |
| embedding | `vector(n)` | n = embedding dimension (§9.3) |
| created_at | timestamptz | |

### 9.3 Embedding dimension rule
The `vector(n)` dimension **must match the embedding model** and be identical for
ingest and query. Changing models requires re-embedding.

**LOCKED (v0.3):** model = **`nomic-embed-text`** (Ollama), dimension = **768**.
Set via `OLLAMA_EMBEDDING_MODEL` in `.env`; column is `embedding vector(768)` in
`db/init.sql`. Switching to e.g. OpenAI `text-embedding-3-small` (1536) means a new
column dimension and a full re-embed.

### 9.4 `jobs` (or BullMQ-managed) — Phase 4
Track ingestion job id, status, document reference, error, timestamps.

### 9.5 `audit_events` — Phase 6
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid | |
| actor | uuid/text | who |
| action | text | search / upload / login / delete |
| target | text | entity affected |
| metadata | jsonb | old/new values where applicable |
| created_at | timestamptz | when |

---

## 10. API surface (target)

| Method | Path | Requirement | Phase | Status |
|--------|------|-------------|-------|--------|
| GET | `/health` | — | 1 | Done |
| POST | `/chat` | FR-CHAT-01..03 | 1 | Done |
| POST | `/chat/structured` | FR-CHAT-04..06 | 2 | Done |
| POST | `/chat/tools` | FR-TOOL-01 | 2 | Done (Ollama; others stubbed) |
| POST | `/documents` | FR-ING-01..03,06 | 2–3 | Done (raw text + dedup) |
| POST | `/documents/upload` | FR-ING-04..06 | 3 | Done (.txt/.pdf, max 10 MB, dedup) |
| DELETE | `/documents` | — | 3 | Done (wipe all — demo/dev reset utility) |
| POST | `/search` | FR-RAG-02..04 | 2 | Done (top-k cosine) |
| POST | `/query` | FR-GEN-01..04 | 3 | Done (grounded RAG answer + sources) |
| GET | `/jobs/:id` | FR-JOB-03 | 4 | Planned |
| POST | `/chat/stream` | FR-STR-01 | 5 | Planned |
| POST | `/auth/register`, `/auth/login` | FR-AUTH-01 | 6 | Planned |

Contracts follow existing conventions: JSON in/out, DTO validation, Swagger-documented,
`ServiceUnavailable` (503) for provider/config errors, `BadGateway` (502) for invalid
LLM output, `BadRequest` (400) for input validation.

---

## 11. Success metrics & acceptance

### 11.1 Per-phase exit criteria
| Phase | Exit criteria |
|-------|---------------|
| 1 | Demo `curl` chat + structured metadata in README ✅ |
| 2 | Semantic search returns top-k with scores (retrieval only) ✅ (Week 3; Week 4 adds files/async ingest) |
| 3 | Upload doc → ask question → answer + sources ✅ (core RAG via `/query`; file upload in Wk4) |
| 4 | Async ingestion; API non-blocking on upload |
| 5 | Live streaming RAG demo |
| 6 | JWT multi-tenant isolation test passes; audit log present; portfolio-ready |

### 11.2 Project-level success (Week 12)
- Tenant A cannot read tenant B documents (automated test).
- Ingestion survives worker restart.
- p95 query latency logged.
- README with architecture diagram + curl examples; 2-minute demo video.
- Resume bullet + ability to whiteboard RAG + async ingest in ~15 min.

---

## 12. Risks & mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-1 | Time slips (part-time) | Cut scope, never interview prep; one slice/week |
| RSK-2 | Scope creep | One deliverable per phase; defer C-priority items |
| RSK-3 | LLM API cost | Small dev docs, caching (Phase 4), local Ollama default |
| RSK-4 | Inconsistent LLM output | Validate + normalize output; retry (already done for metadata) |
| RSK-5 | Embedding dimension mismatch | Lock model+dimension in config; re-embed on change |
| RSK-6 | Tutorial trap (no real learning) | Every week must change the repo + add interview notes |
| RSK-7 | Tenant data leakage | Enforce tenant filter at data layer + isolation test |

---

## 13. Release / phasing traceability

| Phase | Weeks | Delivers | Key FRs |
|-------|-------|----------|---------|
| 1 Foundations | 1–2 | Chat + structured output | FR-CHAT-* |
| 2 pgvector | 3–4 | Storage + semantic search + text ingest | FR-DB-*, FR-RAG-*, FR-ING-01..03 |
| 3 Full RAG | 5–6 | Upload → answer + citations | FR-ING-04, FR-GEN-* |
| 4 Production | 7–8 | Async ingest, caching, rate limit | FR-JOB-*, FR-CACHE-*, FR-RATE-* |
| 5 Streaming | 9–10 | SSE streaming RAG | FR-STR-* |
| 6 Enterprise | 11–12 | JWT, multi-tenant, audit, polish | FR-AUTH-*, FR-TEN-*, FR-AUD-*, FR-SEC-*, FR-DOC-* |

---

## 14. Glossary

| Term | Meaning |
|------|---------|
| **RAG** | Retrieval-Augmented Generation: retrieve relevant text, then let the LLM answer from it |
| **Embedding** | Vector of numbers representing text meaning; similar meaning → similar vectors |
| **Chunk** | A slice of a document sized to fit retrieval/context limits |
| **Vector search** | Finding nearest vectors (cosine/L2) to a query embedding |
| **pgvector** | Postgres extension adding a `vector` column type + similarity ops |
| **Structured output** | LLM reply constrained to a fixed JSON shape |
| **Tool calling** | LLM requests that the backend run a function, then continues with the result |
| **Agentic RAG** | RAG where the model decides when/what to retrieve via tools (beyond basic RAG) |
| **Multi-tenant** | One system serving isolated tenants; tenant A can't see tenant B data |
| **SSE** | Server-Sent Events: one-way server→client streaming over HTTP |
| **Idempotency** | Repeating an operation (e.g. re-upload) has no additional effect |

---

*Update this document at the end of each phase: flip statuses, lock the embedding model/
dimension in §9.3, and adjust any requirements that changed during the build.*
