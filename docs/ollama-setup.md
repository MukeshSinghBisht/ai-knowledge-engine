# Ollama setup (local, free)

Use **Ollama** for $0 development — chat now, embeddings in Week 3+ for RAG.

## 1. Install Ollama

Download and install: **https://ollama.com/download** (Windows, Mac, or Linux)

After install, Ollama usually runs in the background. Verify:

```powershell
ollama --version
```

## 2. Pull models

```powershell
ollama pull llama3.2
ollama pull nomic-embed-text
```

| Model | Purpose |
|-------|---------|
| `llama3.2` | Chat (`POST /chat`) |
| `nomic-embed-text` | Embeddings (Week 3+ pgvector) |

List installed models:

```powershell
ollama list
```

## 3. Configure this project

`.env` should include:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_CHAT_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_API_KEY=ollama
PORT=3000
```

Copy from example if needed:

```powershell
copy .env.example .env
```

## 4. Start the API

```powershell
cd c:\Users\GN\Documents\aibackendpractice\ai-knowledge-engine
npm run start:dev
```

## 5. Test

**Swagger:** http://localhost:3000/docs → **POST /chat**

**curl:**

```powershell
curl -X POST http://localhost:3000/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is RAG in one sentence?\"}"
```

Expected:

```json
{
  "reply": "...",
  "model": "llama3.2",
  "provider": "ollama",
  "usage": { ... }
}
```

## Switch to Gemini or OpenAI

Change one line in `.env` and restart the server:

```env
LLM_PROVIDER=gemini
# GEMINI_API_KEY=...

# or
LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

See [llm-provider-comparison.md](./llm-provider-comparison.md).

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Ollama error` / connection refused | Start Ollama app or run `ollama serve` |
| `model not found` | Run `ollama pull llama3.2` |
| Very slow first reply | Model loading into RAM — normal on first request |
| Out of memory | Use a smaller model: `ollama pull llama3.2:1b` and set `OLLAMA_CHAT_MODEL=llama3.2:1b` |

## Official links

- https://ollama.com
- https://github.com/ollama/ollama/blob/main/docs/api.md
