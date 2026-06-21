# AI Knowledge Engine

Phase 1 (Week 1): NestJS chat API with switchable **Ollama**, **Google Gemini**, or **OpenAI**.

Later phases add pgvector RAG, BullMQ ingestion, Redis caching, streaming, and multi-tenant auth.

## Prerequisites

- Node.js 20+ (this project was built with **v22.22.0**)
- npm **10.9.7** (or compatible)
- **Ollama** (default, local, free) — [docs/ollama-setup.md](./docs/ollama-setup.md)

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
npm run start:dev
```

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
  }
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
  }
}
```

## Project structure

```text
src/
  chat/       POST /chat, POST /chat/structured
  health/     GET /health
  llm/        Ollama + Gemini + OpenAI providers
docs/
  ollama-setup.md
  gemini-setup.md
  llm-provider-comparison.md
```

## Related

- [Learning roadmap](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap)
