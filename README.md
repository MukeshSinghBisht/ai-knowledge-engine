# AI Knowledge Engine

NestJS API with switchable **Ollama**, **Google Gemini**, or **OpenAI** providers.

- **Phase 1:** chat, structured output, tool/function calling
- **Phase 2 (Week 3):** pgvector semantic search — store documents (chunk + embed) and search by meaning
- **Phase 3:** RAG `/query` (retrieve + answer grounded in sources) and file upload (`.txt`/`.pdf`) with duplicate detection
- **Phase 4.1 (AI Gateway telemetry):** every LLM call is logged with tokens, estimated cost, latency, and `requestId`
- **Next:** fallback → Redis rate limit → cost summary API

After that: async ingestion (BullMQ), SSE streaming, JWT multi-tenant auth.

**Parallel (interview only, not a product phase):** light React refresh inside this chat UI —
hooks + patterns, not a frontend rewrite. See [docs/react-interview-prep.md](./docs/react-interview-prep.md).

See [docs/BRD.md](./docs/BRD.md) for requirements and [docs/ai-gateway-plan.md](./docs/ai-gateway-plan.md) for the gateway build plan.

## Demo

![AI Knowledge Engine demo](./demo/demo.gif)

**RAG walkthrough:** [Full quality (MP4)](./demo/aiknowledgeenginedemo1.mp4) · [Captions (SRT)](./demo/aiknowledgeenginedemo1.srt)

**AI Gateway telemetry (Simple vs Thorough):** [AIKE-GATE-TELEMETRY-DEMO2.mp4](./demo/AIKE-GATE-TELEMETRY-DEMO2.mp4) · script: [demo/GATEWAY-COST-DEMO.md](./demo/GATEWAY-COST-DEMO.md)

Open the built-in chat UI at **http://localhost:3000/** (upload a PDF/TXT, ask a question, see answer + sources).

Swagger: **http://localhost:3000/docs** · Full walkthrough: [demo/README.md](./demo/README.md).

## Prerequisites

- Node.js 20+ (this project was built with **v22.22.0**)
- npm **10.9.7** (or compatible)
- **Ollama** (default, local, free) — [docs/ollama-setup.md](./docs/ollama-setup.md)
- **Docker** (for Postgres + pgvector, Phase 2+)

## LLM providers

| Provider | Setup doc | When to use |
|----------|-----------|-------------|
| **Ollama** (default) | [ollama-setup.md](./docs/ollama-setup.md) | Free local dev, full RAG path |
| **Gemini** | [gemini-setup.md](./docs/gemini-setup.md) | Free cloud, no GPU |
| **OpenAI** | `.env.example` | Paid, interview polish |

**Comparison table:** [docs/llm-provider-comparison.md](./docs/llm-provider-comparison.md)

## Tooling & versions

| Tool / package | Version |
|----------------|---------|
| Node.js | 22.22.0 |
| npm | 10.9.7 |
| NestJS CLI | 11.0.21 |
| NestJS core | 11.1.24 |
| TypeScript | 5.9.3 |
| `@google/generative-ai` | 0.24.1 |
| OpenAI SDK (`openai`) | 6.39.1 |
| `@nestjs/swagger` | 11.4.4 |

## Setup (Ollama — default)

**Full guide:** [docs/ollama-setup.md](./docs/ollama-setup.md)

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Install Ollama from https://ollama.com/download, then:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

Start the database (Postgres + pgvector), then the app:

```bash
docker compose up -d      # Postgres + pgvector on host port 5433
npm run start:dev
```

> Note: the container maps host port **5433** (5432 is often taken by a local Postgres).
> Change `DB_PORT` in `.env` + `docker-compose.yml` if needed.

`.env` (default):

```env
LLM_PROVIDER=ollama
OLLAMA_CHAT_MODEL=llama3.2
```

### Switch provider

```env
LLM_PROVIDER=gemini   # + GEMINI_API_KEY
LLM_PROVIDER=openai   # + OPENAI_API_KEY
```

Restart the server after changing `.env`.

## Swagger (API docs)

| Link | Description |
|------|-------------|
| [http://localhost:3000/docs](http://localhost:3000/docs) | **Swagger UI** |
| [http://localhost:3000/docs-json](http://localhost:3000/docs-json) | **OpenAPI JSON** |

## API

### Health check

```bash
curl http://localhost:3000/health
```

### Chat

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"What is RAG in one sentence?\"}"
```

**Response:**

```json
{
  "reply": "...",
  "model": "llama3.2",
  "provider": "ollama",
  "usage": {
    "promptTokens": 25,
    "completionTokens": 40,
    "totalTokens": 65
  },
  "requestId": "3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44",
  "costUsd": 0.0000037,
  "latencyMs": 842
}
```

### Structured document metadata (Week 2)

Extract validated metadata from raw document text — useful before chunking/embedding in later RAG phases.

```bash
curl -X POST http://localhost:3000/chat/structured \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Return Policy\\n\\nItems may be returned within 30 days of purchase with receipt.\"}"
```

**Response:**

```json
{
  "metadata": {
    "title": "Return Policy",
    "language": "en",
    "documentType": "policy",
    "tags": ["returns", "refund", "receipt"],
    "indexable": true,
    "confidence": 0.92
  },
  "model": "llama3.2",
  "provider": "ollama",
  "usage": {
    "promptTokens": 120,
    "completionTokens": 80,
    "totalTokens": 200
  },
  "requestId": "3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44",
  "costUsd": 0.0000088,
  "latencyMs": 1200
}
```

### Store a document (Week 3)

Chunks the text, embeds each chunk (`nomic-embed-text`), and stores vectors in pgvector.

```bash
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Return Policy\\n\\nItems may be returned within 30 days of purchase with a valid receipt.\"}"
```

**Response:** `{ "id": "...", "title": "Return Policy", "sourceType": "text", "chunkCount": 1, "duplicate": false }`

Re-sending identical content is a no-op — the response comes back with `"duplicate": true` and nothing is re-embedded.

### Upload a file (.txt or .pdf)

Extracts the text, then ingests it exactly like `POST /documents` (max 10 MB).

```bash
curl -X POST http://localhost:3000/documents/upload \
  -F "file=@./policy.pdf" \
  -F "title=Return Policy"
```

**Response:** `{ "id": "...", "title": "Return Policy", "sourceType": "pdf", "chunkCount": 12, "duplicate": false }`

### Semantic search (Week 3)

Embeds the query and returns the top-k most similar chunks by cosine similarity.

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"how many days to return an item?\",\"topK\":3}"
```

**Response:**

```json
{
  "query": "how many days to return an item?",
  "results": [
    {
      "chunkId": "...",
      "documentId": "...",
      "title": "Return Policy",
      "chunkIndex": 0,
      "content": "Return Policy Items may be returned within 30 days...",
      "score": 0.78
    }
  ]
}
```

### Ask a question (RAG)

Retrieves the top-k chunks and answers **using only those chunks**, returning the sources.

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"How long is the guarantee on Acme products?\"}"
```

**Response:**

```json
{
  "answer": "All Acme Electronics products come with a 2-year limited warranty covering manufacturing defects.",
  "grounded": true,
  "sources": [
    { "chunkId": "...", "title": "Acme Electronics Warranty", "score": 0.72, "content": "..." }
  ],
  "model": "llama3.2",
  "provider": "ollama",
  "usage": { "promptTokens": 485, "completionTokens": 29, "totalTokens": 514 },
  "requestId": "3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44",
  "costUsd": 0.00001202,
  "latencyMs": 842
}
```

If nothing relevant is stored, it replies `"I don't know based on the available documents."` instead of guessing.

`requestId` matches rows in `llm_gateway_logs` (embed + generate for one `/query` share the same id). All providers use `.env` token rates (`*_USD_PER_1M`); Ollama values are demo assumptions (local is free in reality).

## Project structure

```text
src/
  chat/       POST /chat, /chat/structured, /chat/tools
  documents/  POST /documents, /documents/upload, /search, DELETE /documents
  query/      POST /query (RAG: retrieve + generate)
  health/     GET /health
  llm/        Ollama + Gemini + OpenAI providers, tools/, embeddings
  gateway/    cost table + llm_gateway_logs (4.1 telemetry)
db/
  init.sql    pgvector + llm_gateway_logs
demo/
  README.md               step-by-step demo runbook
  GATEWAY-COST-DEMO.md    Simple vs Thorough + gateway cost talk track
  demo.gif                inline README preview (~2.7 MB)
  aiknowledgeenginedemo1.mp4   RAG walkthrough
  aiknowledgeenginedemo1.srt   captions for the RAG demo
  AIKE-GATE-TELEMETRY-DEMO2.mp4   gateway cost / Simple vs Thorough demo
  ai-knowledge-engine-handbook.pdf   sample doc ("ask the AI about itself")
  generate-handbook.js    regenerates the PDF
docker-compose.yml   Postgres 16 + pgvector
docs/
  BRD.md
  ai-gateway-plan.md   next phase: telemetry, fallback, rate limits, cost summary
  react-interview-prep.md   light React refresh via this chat UI (not a FE project)
  ollama-setup.md
  gemini-setup.md
  llm-provider-comparison.md
```

## Future — AI Gateway (Phase 4)

All LLM calls go through one gateway instead of hitting providers directly.

| Slice | What it adds |
|-------|----------------|
| **4.1 Telemetry** | **Done.** Config cost table, `llm_gateway_logs`, `requestId` + cost + latency on `/chat` and `/query` |
| **4.2 Fallback** | Ordered retry (e.g. OpenAI → Gemini → Ollama), timeout, max attempts, log primary vs fallback |
| **4.3 Rate limit** | Redis counter per user/API key; **429** when over X req/min |
| **4.4 Summary API** | `GET /gateway/summary` — cost today, by provider, avg latency (JSON only) |
| **4.5 Positioning** | README + short demo + resume line: *AI Gateway / LLM cost & telemetry management* |

**4.1 alone is demoable.** Full plan: [docs/ai-gateway-plan.md](./docs/ai-gateway-plan.md).  
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

- [Learning roadmap](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap)
