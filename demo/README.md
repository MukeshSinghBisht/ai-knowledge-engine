# Demo Runbook — AI Knowledge Engine

A 5-minute live demo that shows the engine answering questions about **itself**, then
about **you** after you feed it your résumé. The "wow" moments are (1) it cites its
sources, (2) it refuses to answer what it doesn't know, and (3) it instantly becomes
an expert on any document you give it — no code change.

---

## 0. Before the demo (setup once)

Make sure these are running:

```powershell
# 1. Ollama (local models)
ollama serve            # if not already running
ollama pull llama3.2
ollama pull nomic-embed-text

# 2. Postgres + pgvector
docker compose up -d

# 3. The API
node dist/main.js        # or: npm run start:dev
```

Open **http://localhost:3000/docs** — this is the screen you'll present from.

> Tip: for the crispest answers, set `LLM_PROVIDER=gemini` in `.env` (needs an API key).
> The local `llama3.2` works offline but is a bit more verbose.

---

## 1. Start clean

Wipe any leftover data so the "I don't know" moment works.

- **Swagger:** `documents` → **DELETE /documents** → *Try it out* → *Execute*
- **PowerShell:** `curl.exe -X DELETE http://localhost:3000/documents`

Expect: `{ "deletedDocuments": 0, "deletedChunks": 0 }` (or whatever was there).

---

## 2. Load the product handbook

Upload the bundled handbook so the engine knows about the project.

- **Swagger:** **POST /documents/upload** → *Try it out* → choose file
  `demo/ai-knowledge-engine-handbook.pdf` → set title `AI Knowledge Engine Handbook` → *Execute*
- **PowerShell:**

```powershell
curl.exe -X POST http://localhost:3000/documents/upload `
  -F "file=@.\demo\ai-knowledge-engine-handbook.pdf" `
  -F "title=AI Knowledge Engine Handbook"
```

Expect: `sourceType: "pdf"`, `chunkCount: ~21`, `duplicate: false`.
Say out loud: *"It just split a multi-page PDF into 21 searchable pieces."*

---

## 3. Ask about the product (POST /query)

Run these one at a time. Each answer comes back **with sources**.

| Ask | What it proves | Expected gist |
|-----|----------------|---------------|
| What embedding model does this project use and how many dimensions? | precise fact retrieval | nomic-embed-text, 768 |
| Which language model providers are supported? | multi-fact answer | Ollama, Gemini, OpenAI |
| How does the system avoid hallucinations? | it explains grounding | retrieves context, answers only from it |
| What happens if I upload the same document twice? | dedup knowledge | idempotent, returns existing, embeds nothing |
| Does it support multi-tenant authentication yet? | honest roadmap answer | not yet — planned for phase six |

Body for each (Swagger or PowerShell):

```json
{ "query": "What embedding model does this project use and how many dimensions?" }
```

After one answer, **expand the `sources` array** and say:
*"Every answer cites the exact passages it used — so it's auditable, not a black box."*

---

## 4. The turn — ask about YOU (still refuses)

Résumé is **not** loaded yet, so this should be declined.

```json
{ "query": "What is Mukesh Singh Bisht's current job title and how many years of experience does he have?" }
```

Expect: **"I don't know based on the available documents."**
Say: *"It won't guess about things it hasn't been given — watch what happens when I give it my résumé."*

---

## 5. The reveal — upload your résumé live

- **Swagger:** **POST /documents/upload** → choose your résumé PDF → title `My Resume` → *Execute*
- **PowerShell:**

```powershell
curl.exe -X POST http://localhost:3000/documents/upload `
  -F "file=@C:\path\to\your_resume.pdf" `
  -F "title=My Resume"
```

Expect: `sourceType: "pdf"`, a chunk count, `duplicate: false`.

---

## 6. Ask about you again (now it knows)

```json
{ "query": "What is the candidate's current job title and how many years of experience?" }
```

```json
{ "query": "What are the candidate's main technical skills?" }
```

Expect: real answers pulled from your résumé, each with sources.
Closing line: *"Same engine, zero code change. Point it at your internal wiki, product
docs, or support tickets and it works exactly the same way."*

---

## 7. Reset for the next run

`DELETE /documents` again (Swagger or curl), then repeat from step 2.

---

## Quick reference — all endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/documents` | store raw text |
| POST | `/documents/upload` | upload .txt / .pdf |
| POST | `/search` | raw top-k chunks (no answer) |
| POST | `/query` | grounded answer + sources (the star of the demo) |
| DELETE | `/documents` | wipe everything (demo reset) |
| GET | `/health` | is it up? |

## Notes

- Keep your résumé PDF **outside the repo** — it's personal data and should not be committed.
- If a request fails with a connection error after a DB reset, restart the API.
- Scanned/image-only PDFs won't work (no extractable text) — they return a 400.
