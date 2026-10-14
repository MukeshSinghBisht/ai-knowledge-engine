# LLM provider comparison (development)

Which API to use for this project and the **12-week AI backend roadmap**.

> Full version also lives in the [learning roadmap repo](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap/blob/main/docs/llm-provider-comparison.md).

---

## Best picks for your project

| Option | Cost | Chat | Embeddings (RAG) | API key | Best for |
|--------|------|------|------------------|---------|----------|
| **Ollama (local)** | **$0 real bill** (gateway uses demo `*_USD_PER_1M`) | ✅ | ✅ (`nomic-embed-text`) | No | **Best overall for learning** |
| **Google Gemini** | Free tier | ✅ | ✅ | Yes (free) | Free cloud, no GPU needed |
| **Groq** | Free tier / account limits apply | ✅ fast | ❌ | Yes | Cloud chat; pair with Gemini embeddings |
| **GitHub Models** | Free | ✅ | ❌ | GitHub token | Quick chat experiments |
| **Cloudflare Workers AI** | Free allocation: 10,000 Neurons/day | ✅ | ❌ in this integration | Yes | Cloud generation; requests stop at daily free quota |
| **OpenAI** | Paid (~$5+ credits) | ✅ | ✅ | Yes (paid) | Portfolio polish / interviews |

---

## Default: Ollama

The example configuration defaults to **Ollama** (`LLM_PROVIDER=ollama`) — free, local,
chat + embeddings. For an 8 GB machine or a hosted demo, use Gemini to avoid local
inference.

See [ollama-setup.md](./ollama-setup.md).

---

## Switch provider

```env
# Ollama (default)
LLM_PROVIDER=ollama
OLLAMA_CHAT_MODEL=llama3.2

# Gemini
LLM_PROVIDER=gemini
LLM_EMBEDDING_PROVIDER=gemini
LLM_FALLBACK_ORDER=gemini
LLM_MAX_ATTEMPTS=1
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=gemini-3.8-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

# Cloudflare generation with Gemini embeddings
LLM_PROVIDER=cloudflare
LLM_EMBEDDING_PROVIDER=gemini
LLM_FALLBACK_ORDER=cloudflare
LLM_MAX_ATTEMPTS=1
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_CHAT_MODEL=@cf/meta/llama-3.2-3b-instruct
GEMINI_API_KEY=...
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

---

## Next: AI Gateway

Providers stay the same. The gateway wraps them with one cost table
(`OLLAMA_*` / `OPENAI_*` / `GEMINI_*_USD_PER_1M` / `GROQ_*_USD_PER_1M` /
`CLOUDFLARE_*_USD_PER_1M` — Ollama rates
are demo assumptions; local is free in reality), fallback order, rate limits,
`llm_gateway_logs`.

```env
OLLAMA_INPUT_USD_PER_1M=0.02
OLLAMA_OUTPUT_USD_PER_1M=0.08
OPENAI_INPUT_USD_PER_1M=0.15
OPENAI_OUTPUT_USD_PER_1M=0.60
GEMINI_INPUT_USD_PER_1M=0.075
GEMINI_OUTPUT_USD_PER_1M=0.30
GROQ_INPUT_USD_PER_1M=0
GROQ_OUTPUT_USD_PER_1M=0
CLOUDFLARE_INPUT_USD_PER_1M=0
CLOUDFLARE_OUTPUT_USD_PER_1M=0
```

See [ai-gateway-plan.md](./ai-gateway-plan.md).

## Related

- [Gemini setup](./gemini-setup.md)
- [Learning roadmap](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap)
