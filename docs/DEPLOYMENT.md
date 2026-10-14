# Deployment Guide

How to host the AI Knowledge Engine so anyone can try it from a public URL — for a
LinkedIn/YouTube demo or a portfolio link.

## Why the cloud setup differs from local

Locally the app uses **Ollama** for both chat and embeddings. Ollama needs several GB
of RAM and can't run on cheap/free hosting tiers. The hosted version uses Google Gemini,
so model inference does not use your computer's RAM. The current embedding integration
uses `gemini-embedding-2` with output dimensionality set to 768 to match `vector(768)`.

| Concern          | Local                                   | Hosted                              |
| ---------------- | --------------------------------------- | ----------------------------------- |
| LLM + embeddings | Ollama (`llama3.2`, `nomic-embed-text`) | Gemini API (model IDs configurable) |
| Postgres         | Docker container                        | Managed (Neon / Supabase)           |
| SSL to DB        | off                                     | on (`DB_SSL=true`)                  |

## Zero-cost demo stack (within free-tier quotas)

- **Database:** [Neon Free](https://neon.com/pricing), with pgvector enabled.
- **App:** [Render Free](https://render.com/docs/free), deploying this repo's Dockerfile.
- **LLM and embeddings:** Google Gemini API's free tier, with a Gemini-only provider chain.

This avoids running Ollama or Postgres on your 8 GB machine. The app is public while
deployed, but free services can sleep, have strict quotas, or change their terms. Render
free web services sleep after 15 minutes without traffic; the first visit after that can
take about a minute to wake. Neon Free currently scales compute to zero after inactivity
and includes a bounded amount of compute/storage/egress. Confirm the current provider
limits before deployment; free-tier availability is not an uptime or cost guarantee.

For a hard $0 budget, do not attach a payment method or enable a paid Gemini tier. If a
provider requires payment details to deploy, stop and choose another free option. When a
free quota is exhausted, the demo should return an error rather than fall back to a paid
provider.

### Visitor uploads and privacy

- The browser gets an opaque, HTTP-only session cookie. Its uploads are only returned in
  search and RAG results for that same browser session; the shared sample corpus remains
  visible to everyone.
- Each visitor may store up to 3 documents; the public demo holds at most 100 active
  visitor uploads total. Files are limited to 10 MB each and extracted text to 50,000
  characters. Visitor uploads expire after 7 days. The "Clear my uploads" button only
  clears that visitor's documents.
- Each anonymous browser session may submit up to 5 RAG questions during its 7-day
  session window. The quota is enforced in PostgreSQL before embeddings or generation
  run, and persists across page reloads. Because there is no account login, clearing
  cookies or switching browsers can create a new anonymous session; this is a demo
  limit, not identity-proof abuse prevention.
- Demo activity is recorded in `demo_activity_sessions` when a visitor submits a
  question or document. To see the total unique browser sessions that tried the demo,
  recent sessions, and submission totals, run this in the Neon SQL Editor:

  ```sql
  SELECT
    COUNT(*) AS total_unique_sessions,
    COUNT(*) FILTER (
      WHERE last_seen_at >= now() - interval '7 days'
    ) AS sessions_active_last_7_days,
    COALESCE(SUM(query_submissions), 0) AS question_submissions,
    COALESCE(SUM(upload_submissions), 0) AS upload_submissions
  FROM demo_activity_sessions;
  ```

  This counts anonymous browser sessions that submit an action, not page views or
  verified individual people. The app stores only an opaque session ID, activity
  timestamps, and aggregate submission counts—not IP addresses, questions, or files.
  Since the browser cookie lasts 7 days and can be cleared, one person may be counted
  more than once. Activity rows are retained until manually deleted.
- This is anonymous demo isolation, **not account-grade security**. Do not upload
  confidential or sensitive files. Uploaded text is sent to the configured embedding and
  generation providers. Gemini's free tier may use submitted content to improve its
  products; review current terms before sharing the URL.
- Existing rows in `documents` with no `owner_id` remain visible to everyone as shared
  samples. Review and remove any old visitor uploads before making an existing database
  public; the old schema did not record who uploaded them. The updated
  [`db/init.sql`](../db/init.sql) adds the visitor ownership column and migrates the
  previous global content-hash index.

---

## Step 1 — Provision Neon Postgres with pgvector

1. Create a Neon Free project and copy its connection details.
2. In the Neon SQL editor, run [`db/init.sql`](../db/init.sql). This enables pgvector,
   creates the tables/indexes, and adds `owner_id` if upgrading an existing database.
3. Keep the database small and use a single project/branch for the demo.

## Step 2 — Deploy the app to Render Free

1. Connect the GitHub repository in Render using **New → Web Service**.
2. Select the **Free** instance and Docker runtime (the repository includes a
   `Dockerfile`).
3. Add the environment variables below, then deploy.
4. Share the resulting `https://...onrender.com` URL. Your laptop does not need to stay
   on for visitors to use it.

## Step 3 — Environment variables on the host

```
LLM_PROVIDER=cloudflare
LLM_EMBEDDING_PROVIDER=gemini
LLM_FALLBACK_ORDER=cloudflare
LLM_MAX_ATTEMPTS=1
GEMINI_API_KEY=<your-key>
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_API_TOKEN=<token-with-workers-ai-permission>
CLOUDFLARE_CHAT_MODEL=@cf/meta/llama-3.2-3b-instruct

DB_HOST=<managed-db-host>
DB_PORT=5432
DB_USER=<db-user>
DB_PASSWORD=<db-password>
DB_NAME=<db-name>
DB_SSL=true

THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

> Do **not** reuse a Gemini key that has been committed to a public repo — generate a
> fresh one for production and keep it only in the host's env settings.
> Cloudflare Workers AI handles generation; Gemini embeddings request 768 output
> dimensions and use matching document/query task formats. Cloudflare's Workers Free
> plan currently includes 10,000 Neurons/day; monitor usage because requests fail after
> the free allocation is exhausted. Do not upgrade or enable paid billing if the demo
> must remain at $0. Gateway costs show zero for Cloudflare by default and do not track
> Neuron consumption. Changing embedding models requires re-embedding stored documents.

## Step 4 — Verify

```bash
curl https://<your-app>/health
# Keep a cookie jar so upload and query use the same visitor session:
curl -c cookies.txt -b cookies.txt -X POST https://<your-app>/documents/upload \
  -F "file=@demo/ai-knowledge-engine-handbook.pdf"
curl -c cookies.txt -b cookies.txt -X POST https://<your-app>/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What embedding model does this project use?"}'
```

Swagger is live at `https://<your-app>/docs`.

## Notes & gotchas

- **Rate limiting is on.** Use a conservative `THROTTLE_LIMIT` on a public app to protect
  the free API quota; it is not a per-account abuse-prevention system.
- **Free tiers sleep.** Tell visitors the first request after inactivity can be slow.
- **Embeddings must match.** If you ingested locally with Ollama (`nomic-embed-text`) and
  query in the cloud with Gemini, vectors won't be comparable. Re-ingest documents in the
  environment you'll query from. Use the current Gemini embedding model configured above.
- **Cost control.** Set only Gemini as the provider and do not configure paid-provider
  credentials or a fallback to Ollama/OpenAI. Check Gemini's current free-tier quotas;
  quotas and available models change over time.
- **Don't expose Ollama.** There's no need to host Ollama; the cloud build uses Gemini only.

## Troubleshooting

- **`429` on chat/embeddings.** The free project may have exhausted its quota or may not
  have free-tier access to that model. Wait for the quota reset or choose another model
  available at no charge. Do not enable billing if the demo must stay at $0.
- **`404` on embeddings.** Confirm `gemini-embedding-2` is available to the key/project
  and that the Generative Language API is enabled. The integration requires a
  768-dimensional response to match the pgvector column.
- **Ingest vs query embedding mismatch.** Always ingest and query with the same provider.
  Switching providers requires re-ingesting the documents.
