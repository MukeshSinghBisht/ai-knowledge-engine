# AI Knowledge Engine

A NestJS **RAG API with an AI Gateway layer**: upload documents, ask questions, get answers grounded in your sources with citations, and see the cost, latency and provider used for every LLM call.

Runs fully local (Ollama + Docker) **or** on a $0 hosted stack (Render + Neon + Cloudflare Workers AI + Gemini embeddings).
NestJS API with switchable **Ollama**, **Google Gemini**, or **OpenAI** providers.

- **Phase 1:** chat, structured output, tool/function calling
- **Phase 2 (Week 3):** pgvector semantic search — store documents (chunk + embed) and search by meaning
- **Phase 3:** RAG `/query` (retrieve + answer grounded in sources) and file upload (`.txt`/`.pdf`) with duplicate detection
- **AI Gateway:** telemetry, provider fallback, and `GET /gateway/summary` are implemented
- **Next:** Redis-backed per-API-key quota, then RAG evaluation

After that: async ingestion (BullMQ), SSE streaming, JWT multi-tenant auth.

**Parallel (interview only, not a product phase):** light React refresh inside this chat UI —
hooks + patterns, not a frontend rewrite. See [docs/react-interview-prep.md](./docs/react-interview-prep.md).

See [docs/BRD.md](./docs/BRD.md) for requirements and [docs/ai-gateway-plan.md](./docs/ai-gateway-plan.md) for the gateway build plan.

For the dated, status-tracked AI engineering roadmap (evaluations, safety, MCP, observability, and portfolio milestones), see [docs/ai-engineering-roadmap.md](./docs/ai-engineering-roadmap.md).

## Demo

![AI Knowledge Engine demo](./demo/demo.gif)

**Videos:** [RAG walkthrough](./demo/aiknowledgeenginedemo1.mp4) · [Gateway telemetry: Simple vs Thorough](./demo/AIKE-GATE-TELEMETRY-DEMO2.mp4) · [Highlight reel](./demo/upworkuploadeddocs/Upwork_Demo_HighlightAIKE.mp4)

> **Live demo:** https://ai-knowledge-engine-wcmz.onrender.com — Swagger at https://ai-knowledge-engine-wcmz.onrender.com/docs. Hosted on free tiers, so it sleeps after 15 min idle and the first load can take about a minute. Limits: 5 questions and 3 uploads per browser session.

## What it does

| Capability | Details |
|---|---|
| **RAG** | Chunk, embed, pgvector cosine search, then answer using **only** the retrieved sources. Replies "I don't know based on the available documents" instead of guessing. |
| **Citations** | Every answer returns its source chunks, titles and similarity scores. |
| **Ingestion** | `.txt` / `.pdf` upload (10 MB max), content-hash **duplicate detection**, chunking. |
| **Simple vs Thorough retrieval** | `mode=simple` retrieves top 2 chunks (cheap, fast); `mode=thorough` retrieves top 12 (more context, higher cost). |
| **AI Gateway telemetry** | Every LLM call logs `requestId`, provider, model, tokens, estimated USD cost and latency to `llm_gateway_logs`. Viewable in the UI's Gateway logs panel. |
| **Usage summary** | The UI shows estimated AI spend today (UTC) and all time, with input/output tokens and a provider filter. Totals include each logged provider attempt, including retries. |
| **Provider fallback** | Ordered retry across Ollama / Gemini / OpenAI / Groq / Cloudflare with per-call timeout; each response includes `attempts[]`. |
| **Separate embedding provider** | Chat and embeddings can use different providers (`LLM_EMBEDDING_PROVIDER`). |
| **Structured output + tools** | `/chat/structured` (validated JSON metadata), `/chat/tools` (function calling). |
| **Public-demo safeguards** | Per-browser session isolation of uploads, 5 questions/session, 3 uploads/session, 7-day expiry, IP throttling. |

## Architecture

```text
 Browser UI / Swagger / curl
          │
          ▼
 ┌────────────────────────── NestJS API ───────────────────────────┐
 │  documents/  upload → extract → chunk → dedup → embed → store   │
 │  query/      embed question → pgvector top-K → grounded prompt  │
 │                                   │                             │
 │  gateway/    ◄── all LLM calls ───┘                             │
 │     • provider chain + timeout + fallback (attempts[])          │
 │     • cost table (USD / 1M tokens) → llm_gateway_logs           │
 │  llm/        Ollama · Gemini · OpenAI · Groq · Cloudflare       │
 └───────────────┬──────────────────────────────┬──────────────────┘
                 ▼                              ▼
     PostgreSQL + pgvector               LLM / embedding providers
  (documents, chunks, gateway logs,      (generation: Cloudflare/Ollama,
   demo sessions & quotas)                embeddings: Gemini/Ollama)
```

Diagram image: [AI_Gateway_Architecture.png](./demo/upworkuploadeddocs/AI_Gateway_Architecture.png)

## Two ways to run it

| | Local (full control) | Hosted ($0 demo) |
|---|---|---|
| Generation | Ollama `llama3.2` | Cloudflare Workers AI `llama-3.2-3b-instruct` |
| Embeddings | Ollama `nomic-embed-text` | Gemini `gemini-embedding-2` (768-dim) |
| Database | Docker `pgvector/pgvector:pg16` | Neon Free (pgvector) |
| App host | `npm run start:dev` | Render Free (Dockerfile) |
| Needs | ~8 GB RAM | No local resources |

Hosted setup guide: **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**. Ollama guide: [docs/ollama-setup.md](./docs/ollama-setup.md).

### Quick start (local)

```bash
npm install
cp .env.example .env           # Windows: copy .env.example .env
docker compose up -d           # Postgres + pgvector on host port 5433
ollama pull llama3.2 && ollama pull nomic-embed-text
```

Set `LLM_PROVIDER=ollama` and `LLM_EMBEDDING_PROVIDER=ollama` in `.env`, then:

```bash
npm run start:dev
```

- UI: http://localhost:3000/
- Swagger: http://localhost:3000/docs

### Quick start (hosted)

1. Create a Neon project and run [`db/init.sql`](./db/init.sql).
2. Deploy this repo's Dockerfile on Render (Free).
3. Set env vars (see [DEPLOYMENT.md](./docs/DEPLOYMENT.md)): `LLM_PROVIDER=cloudflare`, `LLM_EMBEDDING_PROVIDER=gemini`, API keys, `DB_*`, `DB_SSL=true`.

> Embeddings from different models are not comparable. Re-ingest documents if you change the embedding provider.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/documents` | Ingest raw text (chunk, embed, store; duplicate-aware) |
| POST | `/documents/upload` | Ingest a `.txt` / `.pdf` file |
| DELETE | `/documents` | Clear your uploads |
| POST | `/search` | Semantic search, top-K chunks by cosine similarity |
| POST | `/query` | **RAG**: grounded answer + sources + gateway telemetry |
| POST | `/chat` | Plain chat via the gateway |
| POST | `/chat/structured` | Validated JSON metadata extraction |
| POST | `/chat/tools` | Function calling |
| GET | `/gateway/logs` | Recent gateway log rows (cost, latency, provider) |
| GET | `/gateway/summary` | Today's UTC and all-time estimated spend, with provider breakdowns |
| GET | `/health` | Health check |

### Example: ask a question

```bash
curl -c c.txt -b c.txt -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"query":"How long is the warranty?","mode":"simple"}'
```

```json
{
  "answer": "All products come with a 2-year limited warranty covering manufacturing defects.",
  "grounded": true,
  "mode": "simple",
  "topK": 2,
  "sources": [{ "title": "Warranty", "score": 0.72, "content": "..." }],
  "provider": "cloudflare",
  "model": "@cf/meta/llama-3.2-3b-instruct",
  "usage": { "promptTokens": 485, "completionTokens": 29, "totalTokens": 514 },
  "requestId": "3f1c0a8e-...",
  "costUsd": 0,
  "latencyMs": 842,
  "attempts": [{ "attempt": 1, "provider": "cloudflare", "outcome": "success", "latencyMs": 842 }]
}
```

## Configuration highlights

| Variable | Meaning |
|---|---|
| `LLM_PROVIDER` | Primary generation provider (`ollama` \| `gemini` \| `openai` \| `groq` \| `cloudflare`) |
| `LLM_EMBEDDING_PROVIDER` | Embedding provider (defaults to `LLM_PROVIDER`) |
| `LLM_FALLBACK_ORDER`, `LLM_MAX_ATTEMPTS`, `LLM_TIMEOUT_MS` | Fallback chain and per-call timeout |
| `*_INPUT_USD_PER_1M`, `*_OUTPUT_USD_PER_1M` | Cost-estimate rates per provider |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Per-IP rate limit |

Full list: [`.env.example`](./.env.example). Never commit real keys; use host env settings.

## Project structure

```text
src/
  chat/            /chat, /chat/structured, /chat/tools
  documents/       ingestion, upload, search, chunking, text extraction
  query/           /query (RAG: retrieve + generate)
  gateway/         cost table, fallback order, timeouts, llm_gateway_logs
  llm/             provider adapters (Ollama, Gemini, OpenAI, Groq, Cloudflare)
  demo-analytics/  anonymous demo-session activity counts
  health/          /health
db/init.sql        pgvector schema + gateway logs + demo tables
public/index.html  built-in chat UI (upload, ask, sources, gateway logs)
demo/              walkthrough, videos, sample handbook PDF
docs/              BRD, gateway plan, deployment, provider comparison, roadmap
```

## Testing

```bash
npm test          # unit tests (gateway cost/summary, fallback order, query service, demo analytics)
npm run test:e2e
```

## Status and roadmap

| Slice | What it adds |
|-------|----------------|
| **4.1 Telemetry** | **Done.** Config cost table, `llm_gateway_logs`, `requestId` + cost + latency on `/chat` and `/query` |
| **4.2 Fallback** | **Done.** Ordered retry + timeout (`LLM_FALLBACK_ORDER` / `LLM_TIMEOUT_MS`), `attempts[]` on responses, UI panel |
| **4.3 Rate limit** | Redis counter per user/API key; **429** when over X req/min |
| **4.4 Summary API and UI** | **Done.** `GET /gateway/summary` returns today and all-time totals with provider breakdowns; the UI has a provider filter |
| **4.5 Positioning** | README + short demo + resume line: *AI Gateway / LLM cost & telemetry management* |

Summary counts each provider attempt, including retries, and uses UTC day boundaries. Full plan: [docs/ai-gateway-plan.md](./docs/ai-gateway-plan.md).
Recorded gateway demo: [AIKE-GATE-TELEMETRY-DEMO2.mp4](./demo/AIKE-GATE-TELEMETRY-DEMO2.mp4) · [GATEWAY-COST-DEMO.md](./demo/GATEWAY-COST-DEMO.md).

## Live walkthrough

See [demo/README.md](./demo/README.md) for a full 5-minute walkthrough: load the bundled
handbook, ask the engine questions about itself (with cited sources), watch it refuse a
question it has no data for, then upload another document and watch it answer instantly.
Use `DELETE /documents` to reset between runs. Preview: [demo.gif](./demo/demo.gif) ·
full quality: [aiknowledgeenginedemo1.mp4](./demo/aiknowledgeenginedemo1.mp4)
([captions](./demo/aiknowledgeenginedemo1.srt)).

Gateway / cost slice: [AIKE-GATE-TELEMETRY-DEMO2.mp4](./demo/AIKE-GATE-TELEMETRY-DEMO2.mp4)
([script](./demo/GATEWAY-COST-DEMO.md)).

## Related

[Learning roadmap](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap)
