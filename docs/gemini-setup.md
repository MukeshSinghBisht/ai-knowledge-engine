# Google Gemini setup (free tier)

Use this guide to get a Gemini API key from Google AI Studio. Use only models available
on the **free tier** if you need to keep usage at $0; free-tier access and quotas can
change. Do not enable billing for a zero-cost demo.

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
LLM_EMBEDDING_PROVIDER=gemini
LLM_FALLBACK_ORDER=gemini
LLM_MAX_ATTEMPTS=1
GEMINI_API_KEY=AIza-your-key-here
GEMINI_CHAT_MODEL=gemini-3.8-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
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

## 6. End-to-end test in the browser UI

This tests the same document-upload and RAG flow a visitor uses. It sends real
embedding and generation requests to Gemini, so keep the test short and check your
free-tier quota first.

### Use free hosted Postgres and start the app

Docker is optional for local development, not part of the zero-cost hosted plan. To keep
Postgres off your computer, use a Neon Free database:

1. Create a Neon Free project and copy its connection details.
2. Open the Neon SQL Editor and run the repository's [`db/init.sql`](../db/init.sql) to
   enable pgvector and create the tables and indexes.
3. In your local `.env`, replace the local database settings with the Neon connection
   details:

   ```env
   DB_HOST=<Neon-host>
   DB_PORT=5432
   DB_USER=<Neon-user>
   DB_PASSWORD=<Neon-password>
   DB_NAME=<Neon-database>
   DB_SSL=true
   ```

   Keep the database password and Gemini API key private. Use a fresh/empty demo database
   if this is the first Gemini RAG test; vectors created with another embedding model
   cannot be compared with Gemini vectors.

4. From the project folder, start only the NestJS app:

```powershell
npm run start:dev
```

Keep this terminal open and wait until Nest reports the API URL. The browser UI and NestJS
process run on your computer, but Postgres and Gemini inference are remote; there is no
need to run Docker or Ollama. To avoid using your computer for the app too, deploy the
Dockerfile to a free app host as described in [`DEPLOYMENT.md`](./DEPLOYMENT.md), then
perform the same UI checks at the public app URL. Free hosting may sleep when idle.

### Test upload, retrieval, and grounded answer

1. Open **http://localhost:3000/** in a regular browser window.
2. Create a small plain-text file named `gemini-ui-test.txt` with this content:

   ```text
   Project Iris manual test

   The support team for Project Iris answers customer requests Monday through Friday.
   Standard refunds are completed within 6 business days after approval.
   The return reference code is IRIS-604.
   ```

3. Click **Upload file** and select `gemini-ui-test.txt`. Expect an upload-success
   message showing that the document was stored and split into chunks.
4. Ask **“What is the return reference code?”** Expect an answer containing
   **IRIS-604**, source content matching your file, and answer metadata showing
   **gemini** and **gemini-3.8-flash**.
5. Ask **“How long do standard refunds take after approval?”** Expect an answer based on
   the document, with a source shown below it.
6. Ask **“What is Project Iris’s office address?”** Since the file does not contain an
   address, expect the assistant to say it does not know based on the available
   documents.
7. Click **Gateway logs**. Recent rows should show Gemini operations, including
   `embed` and `generate`, with successful outcomes. The query answer itself should show
   Gemini as the provider and `gemini-3.8-flash` as the generation model.

### Check that visitor uploads stay private

1. Leave the uploaded document in the regular window.
2. Open **http://localhost:3000/** in a private/incognito window. This creates a separate
   browser session.
3. Ask **“What is the return reference code?”** Expect **“I don't know based on the
   available documents.”** and a no-context status (unless you have separately loaded
   shared sample documents).
4. Return to the regular window and ask the question again. It should still answer
   **IRIS-604**.
5. In the regular window, click **Clear my uploads** and confirm. This clears only that
   browser session's uploaded documents; it does not clear shared sample documents or
   another visitor's uploads.

### Check upload limits

- Try selecting a file larger than **10 MB**; the UI should reject it before upload.
- A visitor can store up to **3 documents**. After three distinct documents have been
  uploaded in one browser session, a fourth should be rejected with a limit message.
- Visitor uploads expire after **7 days**. The expiry is enforced on document ingestion
  and search/query activity.

Do not use confidential or sensitive documents for this test. The browser's session
isolation is intended for an anonymous demo, not account-grade security. Google notes
that content submitted on its free tier may be used to improve its products.

## Free tier notes

- **Free for development** within current daily/monthly rate limits
- Limits and model availability change — check: https://ai.google.dev/gemini-api/docs/pricing
- For learning (dozens of requests per day), free tier is usually enough
- Google documents that free-tier content may be used to improve products; do not submit
  sensitive or confidential documents.

## Models used in this roadmap

| Phase | Model env var | Default | Purpose |
|-------|---------------|---------|---------|
| Chat | `GEMINI_CHAT_MODEL` | `gemini-3.8-flash` | Gemini Interactions API |
| RAG | `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | pgvector / RAG (768 dimensions) |

Gemini embeddings are requested at 768 dimensions for the existing `vector(768)` column.
The same model and task-specific formatting are used for both document and query
embeddings. Changing models requires re-embedding stored documents.

Chat and structured output use Google's current `@google/genai` SDK and Interactions
API. Requests set `store: false`; the SDK dependency is installed by `npm ci`.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `GEMINI_API_KEY is not set` | Add key to `.env` and restart server |
| `403` / API key invalid | Regenerate key in AI Studio |
| `429` / quota limit 0 | Wait for the free quota to reset or choose a model available at no charge. Do not enable billing if you need to keep this project at $0. |
| `404` model not found | Check that the configured model is available to your AI Studio project and that the Generative Language API is enabled. |

## Use Cloudflare Workers AI for generation

Cloudflare Workers AI provides an OpenAI-compatible chat API. This project can use
Cloudflare for answer generation while retaining Gemini for document and query
embeddings.

1. In the Cloudflare dashboard, copy your account ID.
2. Create an API token with Workers AI permission. Keep it private; do not paste it into
   chat or commit it.
3. Confirm the current Workers Free allowance and model availability at
   https://developers.cloudflare.com/workers-ai/platform/pricing/.
4. Set these values in your local `.env`:

   ```env
   LLM_PROVIDER=cloudflare
   LLM_EMBEDDING_PROVIDER=gemini
   LLM_FALLBACK_ORDER=cloudflare
   LLM_MAX_ATTEMPTS=1
   CLOUDFLARE_ACCOUNT_ID=<your-account-id>
   CLOUDFLARE_API_TOKEN=<your-api-token>
   CLOUDFLARE_CHAT_MODEL=@cf/meta/llama-3.2-3b-instruct
   ```

5. Leave `GEMINI_API_KEY` and `GEMINI_EMBEDDING_MODEL=gemini-embedding-2` configured.
   Existing chunks use Gemini embeddings, so you do not need to re-upload the handbook.
6. Restart NestJS, reload the UI, and ask the handbook question again. Successful gateway
   logs should show `cloudflare` for `generate` and `gemini` for `embed`.

The Workers Free plan currently includes 10,000 Neurons per day, and requests fail after
that allocation is exhausted. Do not enable paid billing if the demo must stay at $0.
The gateway's Cloudflare cost estimate defaults to zero because it does not model
Neurons or remaining free allocation. This does not mean usage is unlimited or that
usage beyond the free allocation is free. Cloudflare provides embeddings, but this
project deliberately retains Gemini embeddings so existing vectors remain compatible.

## Official links

- API keys: https://aistudio.google.com/apikey
- Gemini docs: https://ai.google.dev/gemini-api/docs
- Pricing / limits: https://ai.google.dev/pricing
- Groq API keys: https://console.groq.com/keys
- Groq model list: https://console.groq.com/docs/models
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare OpenAI-compatible API: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
