# Demo Runbook — AI Knowledge Engine

A 5-minute live demo that shows the engine answering questions about **itself**, then
about **you** after you feed it your résumé. The "wow" moments are (1) it cites its
sources, (2) it refuses to answer what it doesn't know, and (3) it instantly becomes
an expert on any document you give it — no code change.

**Gateway / cost demo (Simple vs Thorough):** see [GATEWAY-COST-DEMO.md](./GATEWAY-COST-DEMO.md).

**[Recorded gateway demo (MP4)](./AIKE-GATE-TELEMETRY-DEMO2.mp4)**

## Recorded demo (RAG)

![AI Knowledge Engine demo](./demo.gif)

**[Full quality (MP4)](./aiknowledgeenginedemo1.mp4)** · **[Captions (SRT)](./aiknowledgeenginedemo1.srt)**

---

## 0. Before the demo (setup once)

Configure `.env` with Cloudflare Workers AI for answer generation, Gemini for both
document and query embeddings, and a PostgreSQL database such as Neon. The current
demo model is `@cf/meta/llama-3.2-3b-instruct`; Cloudflare Workers Free has a limited
daily AI allocation, so check usage and do not enable paid billing if the demo must stay
at $0.

```powershell
# Start the API and chat UI; Neon and the AI providers are remote.
npm run start:dev
```

Open **http://localhost:3000/** — this is the chat UI you'll present from
(upload → ask → answer with sources). Swagger at `/docs` is still available if you prefer.

> The current demo uses Cloudflare for generation and Gemini Embedding 2 (768 dimensions)
> for both indexing and query search. Keep `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`,
> and `CLOUDFLARE_API_TOKEN` configured locally.
> Demo quota: each browser session can ask up to 5 questions in 7 days. Upload limits
> also apply. This is anonymous session-based demo protection, not account login.

---

## 1. Start clean

Clear this browser session's previous uploads so the "I don't know" moment works.

- **UI:** click **Clear my uploads**
- **Swagger:** `documents` → **DELETE /documents** → _Try it out_ → _Execute_
- **PowerShell:** `curl.exe -X DELETE http://localhost:3000/documents`

This clears only the current browser session's visitor uploads; shared sample documents
and other visitors' uploads are not deleted.

---

## 2. Load the product handbook

Upload the bundled handbook so the engine knows about the project.

- **Swagger:** **POST /documents/upload** → _Try it out_ → choose file
  `demo/ai-knowledge-engine-handbook.pdf` → set title `AI Knowledge Engine Handbook` → _Execute_
- **PowerShell:**

```powershell
curl.exe -X POST http://localhost:3000/documents/upload `
  -F "file=@.\demo\ai-knowledge-engine-handbook.pdf" `
  -F "title=AI Knowledge Engine Handbook"
```

Expect: `sourceType: "pdf"`, `chunkCount: ~22`, `duplicate: false`.
Say out loud: _"It just split a multi-page PDF into searchable pieces."_

---

## 3. Ask about the product (POST /query)

Run these one at a time. Each answer comes back **with sources**.

| Ask                                                                 | What it proves                       | Expected gist                                           |
| ------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| What embedding model does this project use and how many dimensions? | precise fact retrieval               | Gemini Embedding 2, 768                                 |
| Which language model providers are supported?                       | multi-fact answer                    | Ollama, Gemini, OpenAI, Groq, Cloudflare Workers AI     |
| Which provider generates answers in the current demo?               | separates generation from embeddings | Cloudflare Workers AI, `@cf/meta/llama-3.2-3b-instruct` |
| How does the system avoid hallucinations?                           | it explains grounding                | retrieves context, answers only from it                 |
| What happens if I upload the same document twice?                   | dedup knowledge                      | idempotent, returns existing, embeds nothing            |
| Does it support multi-tenant authentication yet?                    | honest roadmap answer                | not yet — planned for phase six                         |

Body for each (Swagger or PowerShell):

```json
{
  "query": "What embedding model does this project use and how many dimensions?"
}
```

After one answer, **expand the `sources` array** and say:
_"Every answer cites the exact passages it used — so it's auditable, not a black box."_

---

## 4. The turn — ask about YOU (still refuses)

Résumé is **not** loaded yet, so this should be declined.

```json
{
  "query": "What is Mukesh Singh Bisht's current job title and how many years of experience does he have?"
}
```

Expect: **"I don't know based on the available documents."**
Say: _"It won't guess about things it hasn't been given — watch what happens when I give it my résumé."_

---

## 5. The reveal — upload your résumé live

- **Swagger:** **POST /documents/upload** → choose your résumé PDF → title `My Resume` → _Execute_
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
{
  "query": "What is the candidate's current job title and how many years of experience?"
}
```

```json
{ "query": "What are the candidate's main technical skills?" }
```

Expect: real answers pulled from your résumé, each with sources.
Closing line: _"Same engine, zero code change. Point it at your internal wiki, product
docs, or support tickets and it works exactly the same way."_

---

## 7. Reset for the next run

Click **Clear my uploads** (or call `DELETE /documents` from the same browser session),
then repeat from step 2.

---

## Quick reference — all endpoints

| Method | Path                | Purpose                                          |
| ------ | ------------------- | ------------------------------------------------ |
| POST   | `/documents`        | store raw text                                   |
| POST   | `/documents/upload` | upload .txt / .pdf                               |
| POST   | `/search`           | raw top-k chunks (no answer)                     |
| POST   | `/query`            | grounded answer + sources (the star of the demo) |
| DELETE | `/documents`        | wipe everything (demo reset)                     |
| GET    | `/health`           | is it up?                                        |

## Notes

- If a request fails with a connection error after a DB reset, restart the API.
- Scanned/image-only PDFs won't work (no extractable text) — they return a 400.

---

## Recording the demo video (for the README)

Recruiters skim — a 60–90 second clip beats a wall of text. Keep it short and captioned.

### Tools (free, Windows)

- **ScreenToGif** — easiest for a lightweight GIF: record a region, trim, export `.gif`.
- **OBS Studio** — best quality; record `.mp4`, then either keep it as MP4 or convert to GIF.
- **Xbox Game Bar** (`Win + G`) — built into Windows, quick `.mp4` capture.

### Shot list (aim for ~75 seconds)

1. **(0:00–0:08)** Open `http://localhost:3000/docs`. Say/caption: _"A RAG engine — it only answers from documents I give it."_
2. **(0:08–0:15)** `DELETE /documents` → Execute. Caption: _"Starting empty."_
3. **(0:15–0:25)** `POST /documents/upload` → pick `ai-knowledge-engine-handbook.pdf` → Execute. Show `chunkCount`. Caption: _"Feed it a PDF — split into chunks + embedded."_
4. **(0:25–0:45)** `POST /query` → "What embedding model does this project use?" → show the answer **and expand `sources`**. Caption: _"Answers with citations."_
5. **(0:45–0:55)** `POST /query` → "What is the candidate's experience?" → **"I don't know."** Caption: _"It won't guess."_
6. **(0:55–1:05)** `POST /documents/upload` → résumé PDF → Execute.
7. **(1:05–1:15)** Repeat the same query → now it answers about the résumé. Caption: _"Same engine, new document, instant expert."_

### Tips

- Record at a smaller window size so text stays readable in a GIF.
- Trim dead air (model latency) — cut the waiting time so it feels snappy.
- Keep the GIF under ~10 MB if committing to the repo; otherwise use the MP4-on-GitHub option.

### Embed it

Already linked from this file and the root README:

- GIF (inline preview): [`demo.gif`](./demo.gif)
- RAG video: [`aiknowledgeenginedemo1.mp4`](./aiknowledgeenginedemo1.mp4)
- RAG captions: [`aiknowledgeenginedemo1.srt`](./aiknowledgeenginedemo1.srt)
- Gateway telemetry video: [`AIKE-GATE-TELEMETRY-DEMO2.mp4`](./AIKE-GATE-TELEMETRY-DEMO2.mp4)
- Gateway talk track: [`GATEWAY-COST-DEMO.md`](./GATEWAY-COST-DEMO.md)

To replace later: overwrite those files and re-run the MP4→GIF conversion if needed.
