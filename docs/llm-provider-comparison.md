# LLM provider comparison (development)

Which API to use for this project and the **12-week AI backend roadmap**.

> Full version also lives in the [learning roadmap repo](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap/blob/main/docs/llm-provider-comparison.md).

---

## Best picks for your project

| Option | Cost | Chat | Embeddings (RAG) | API key | Best for |
|--------|------|------|------------------|---------|----------|
| **Ollama (local)** | **$0 forever** | ✅ | ✅ (`nomic-embed-text`) | No | **Best overall for learning** |
| **Google Gemini** | Free tier | ✅ | ✅ | Yes (free) | Free cloud, no GPU needed |
| **Groq** | Free tier | ✅ fast | ❌ | Yes (free) | Week 1 chat only |
| **GitHub Models** | Free | ✅ | ❌ | GitHub token | Quick chat experiments |
| **Cloudflare Workers AI** | Free tier | ✅ | Limited | Yes | Side experiments |
| **OpenAI** | Paid (~$5+ credits) | ✅ | ✅ | Yes (paid) | Portfolio polish / interviews |

---

## Default: Ollama

This repo defaults to **Ollama** (`LLM_PROVIDER=ollama`) — free, local, chat + embeddings.

See [ollama-setup.md](./ollama-setup.md).

---

## Switch provider

```env
# Ollama (default)
LLM_PROVIDER=ollama
OLLAMA_CHAT_MODEL=llama3.2

# Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=gemini-2.0-flash-lite

# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

---

## Related

- [Gemini setup](./gemini-setup.md)
- [Learning roadmap](https://github.com/MukeshSinghBisht/ai-backend-engineer-roadmap)
