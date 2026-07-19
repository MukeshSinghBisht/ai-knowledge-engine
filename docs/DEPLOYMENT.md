# Deployment Guide

How to host the AI Knowledge Engine so anyone can try it from a public URL — for a
LinkedIn/YouTube demo or a portfolio link.

## Why the cloud setup differs from local

Locally the app uses **Ollama** for both chat and embeddings. Ollama needs several GB
of RAM and can't run on cheap/free hosting tiers. So the hosted version switches to
**Google Gemini**, which is API-based (no heavy compute) and — importantly — its
`text-embedding-004` model outputs **768 dimensions**, matching the `vector(768)` column.
No schema change needed.

| Concern | Local | Hosted |
|---------|-------|--------|
| LLM + embeddings | Ollama (`llama3.1:8b`, `nomic-embed-text`) | Gemini (`gemini-2.0-flash-lite`, `text-embedding-004`) |
| Postgres | Docker container | Managed (Neon / Supabase) |
| SSL to DB | off | on (`DB_SSL=true`) |

## Recommended free-tier stack

- **Database:** [Neon](https://neon.tech) or [Supabase](https://supabase.com) — both ship pgvector.
- **App:** [Render](https://render.com) or [Railway](https://railway.app) — deploy the `Dockerfile` straight from GitHub.
- **LLM:** Google Gemini (you already have a key).

---

## Step 1 — Provision Postgres with pgvector

### Option A: Neon
1. Create a project. Copy the connection string (host, db, user, password).
2. In the Neon SQL editor, run the contents of [`db/init.sql`](../db/init.sql) once
   (creates the `vector` extension, tables, and HNSW index).

### Option B: Supabase
1. Create a project. In the SQL editor run `create extension if not exists vector;`
   then the rest of `db/init.sql`.
2. Get the connection details from Project Settings → Database.

## Step 2 — Deploy the app (Render example)

1. Push this repo to GitHub (already done).
2. Render → **New → Web Service** → connect the repo.
3. Environment: **Docker** (it auto-detects the `Dockerfile`).
4. Add environment variables (below).
5. Deploy. Render gives you a public `https://...onrender.com` URL.

Railway is the same idea: New Project → Deploy from GitHub → add variables.

## Step 3 — Environment variables on the host

```
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
GEMINI_CHAT_MODEL=gemini-2.0-flash-lite
GEMINI_EMBEDDING_MODEL=text-embedding-004

DB_HOST=<managed-db-host>
DB_PORT=5432
DB_USER=<db-user>
DB_PASSWORD=<db-password>
DB_NAME=<db-name>
DB_SSL=true

THROTTLE_TTL=60
THROTTLE_LIMIT=30
```

> Do **not** reuse a Gemini key that has been committed to a public repo — generate a
> fresh one for production and keep it only in the host's env settings.

## Step 4 — Verify

```bash
curl https://<your-app>/health
# then load a doc and query it:
curl -X POST https://<your-app>/documents/upload -F "file=@demo/ai-knowledge-engine-handbook.pdf"
curl -X POST https://<your-app>/query -H "Content-Type: application/json" \
  -d '{"query":"What embedding model does this project use?"}'
```

Swagger is live at `https://<your-app>/docs`.

## Notes & gotchas

- **Rate limiting is on** (30 req/min/IP by default). A public LLM endpoint is otherwise
  an open door to your Gemini quota. Tune with `THROTTLE_TTL` / `THROTTLE_LIMIT`.
- **Free tiers sleep.** Render/Railway free instances spin down when idle; the first
  request after a nap is slow. Fine for a demo — mention it if needn't surprise viewers.
- **Embeddings must match.** If you ingested locally with Ollama (`nomic-embed-text`) and
  query in the cloud with Gemini, vectors won't be comparable. Re-ingest documents in the
  environment you'll query from. Both happen to be 768-dim, so the column is fine either way.
- **Cost control.** `gemini-2.0-flash-lite` is cheap/free-tier friendly. Keep the wipe
  endpoint (`DELETE /documents`) handy to reset demo data.
- **Don't expose Ollama.** There's no need to host Ollama; the cloud build uses Gemini only.

## Troubleshooting

- **`429 ... limit: 0` on chat/embeddings.** The Gemini key's project has no free-tier
  quota (free tier not enabled in the region, or a per-day limit of 0). Enable billing on
  the Google Cloud project behind the key, or use a key from a project that has quota.
  This is an account setting, not a code issue — the request reached Google fine.
- **`404 models/text-embedding-004 ... for embedContent`.** The key/project can't access
  that model. `text-embedding-004` is the right 768-dim model; ensure the Generative
  Language API is enabled for the project and the key isn't API-restricted. (The SDK
  version pinned here can't down-project a 3072-dim model to 768, so stick with
  `text-embedding-004` for the `vector(768)` column.)
- **Ingest vs query embedding mismatch.** Always ingest and query with the same provider.
  Switching providers requires re-ingesting the documents.
