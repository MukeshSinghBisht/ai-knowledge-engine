# Google Gemini setup (free tier)

Use this guide to get a **free API key** for development. No credit card required for the free tier (limits apply).

## 1. Create a Google account

Use any Google/Gmail account, or create one at https://accounts.google.com

## 2. Open Google AI Studio

Go to: **https://aistudio.google.com**

Sign in with your Google account.

## 3. Create an API key

1. Click **Get API key** (or go to https://aistudio.google.com/apikey)
2. Click **Create API key**
3. Choose **Create API key in new project** (fine for learning)
4. Copy the key — it looks like: `AIza...`

Keep this key private. Do not commit it to GitHub.

## 4. Configure this project

```powershell
cd c:\Users\GN\Documents\aibackendpractice\ai-knowledge-engine
copy .env.example .env
```

Edit `.env`:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIza-your-key-here
GEMINI_CHAT_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
PORT=3000
```

## 5. Start the server

```powershell
npm run build
npm run start
```

Or for hot reload:

```powershell
npm run start:dev
```

## 6. Test

**Swagger:** http://localhost:3000/docs

**curl:**

```powershell
curl -X POST http://localhost:3000/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is RAG in one sentence?\"}"
```

Expected response includes:

```json
{
  "reply": "...",
  "model": "gemini-2.0-flash",
  "provider": "gemini",
  "usage": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0 }
}
```

## Free tier notes

- **Free for development** with daily/monthly rate limits
- Limits change — check: https://ai.google.dev/pricing
- For learning (dozens of requests per day), free tier is usually enough
- Set `LLM_PROVIDER=openai` later if you switch providers

## Models used in this roadmap

| Phase | Model env var | Default | Purpose |
|-------|---------------|---------|---------|
| Week 1–2 | `GEMINI_CHAT_MODEL` | `gemini-2.0-flash` | Chat API |
| Week 3+ | `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | pgvector / RAG |

Embedding support will be wired in Phase 2 (pgvector weeks).

## Troubleshooting

| Error | Fix |
|-------|-----|
| `GEMINI_API_KEY is not set` | Add key to `.env` and restart server |
| `403` / API key invalid | Regenerate key in AI Studio |
| `429` / quota limit 0 | Enable **Generative Language API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com) for your project. Some regions require linking a billing account even for free tier. |
| `404` model not found | Use a model from the list API — try `gemini-2.0-flash-lite` or `gemini-2.5-flash` |

## Official links

- API keys: https://aistudio.google.com/apikey
- Gemini docs: https://ai.google.dev/gemini-api/docs
- Pricing / limits: https://ai.google.dev/pricing
