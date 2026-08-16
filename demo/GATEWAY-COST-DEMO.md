# Demo Script — AI Gateway Cost & Simple vs Thorough

**Audience:** interview / portfolio walkthrough (~6–8 min)  
**UI:** http://localhost:3000 (or http://localhost:3001 if 3000 is busy)  
**Goal:** show RAG grounding **and** gateway telemetry (cost, latency, retrieval depth).

**Recorded demo:** [AIKE-GATE-TELEMETRY-DEMO2.mp4](./AIKE-GATE-TELEMETRY-DEMO2.mp4)

---

## 0. Setup (before the call)

```powershell
ollama serve
ollama pull llama3.2
ollama pull nomic-embed-text

cd ai-knowledge-engine
docker compose up -d
npm run start:dev
```

Open the chat UI. Confirm **Simple / Thorough** toggle is visible under the chat.

Optional (projector-friendly costs): in `.env` temporarily raise Ollama demo rates, then restart:

```env
OLLAMA_INPUT_USD_PER_1M=12
OLLAMA_OUTPUT_USD_PER_1M=48
```

Say out loud if you do this: *“These are demo assumptions so cost is readable; local Ollama is free in reality.”*

---

## 1. Wipe + upload (30–45s)

1. Click **Wipe data** (start clean).
2. **Upload** `demo/ai-knowledge-engine-handbook.pdf`.

**Say:** *“We ingest a PDF into chunks + embeddings in Postgres/pgvector. Answers must come only from this doc.”*

---

## 2. Grounded fact (Simple) (~1 min)

**Mode:** Simple  
**Ask exactly (wording matters):**  
`what is the embedding model used in this project?`

Do **not** add “and how many dimensions?” — that phrasing can rank the right chunk into top-2 and Simple may succeed.

**What to point at under the answer:**
- Sources (expand Source 1 / 2 — usually providers / data-model, **not** `nomic-embed-text`)
- Meta: `Simple · topK 2 · … · $… · requestId`

**Expect (usually):** *I don't know based on the available documents.*  
**Say:** *“Simple only pulls the top 2 chunks — cheaper, but the fact we need ranked lower, so the model correctly refuses.”*

> If Simple unexpectedly answers, open the sources anyway and still go to Thorough to show **more sources + higher `$`**. Cost contrast still works.

---

## 3. Same question, Thorough (~1–2 min) — cost contrast

**Mode:** Thorough  
**Ask the same exact question again:**  
`what is the embedding model used in this project?`

**Expect:** correct answer (`nomic-embed-text`, 768 dims), more sources, **higher `$` cost**.

**Say:**  
*“Thorough uses 12 chunks, so the nomic-embed-text passage is included. More context → more tokens → higher estimated cost. Same question, different spend.”*

Compare the two `$` values on screen.

---

## 4. Guardrail / no hallucinate (~45s)

**Mode:** either  
**Ask:** `Who painted the Mona Lisa?`

**Expect:** *I don't know based on the available documents.*  
(Handbook mentions this example; still a strong “we don’t invent” moment.)

**Say:** *“Even if the model knows the answer from training data, the system prompt forces grounding. No source → refuse.”*

---

## 5. Gateway logs in the UI (~1 min)

Click **Gateway logs** (toolbar). Hit **Refresh** after your Simple/Thorough asks.

**Point out in the table:**
- One UI ask → `embed` + `generate` rows (same `request` id prefix)
- `mode` = `simple` / `thorough`, `topK` = 2 / 12
- `cost` / `ms` match the answer meta line

**Say:** *“This is the AI Gateway layer — every LLM call is metered for cost and latency, not just answered.”*

(Optional SQL still works via `docker exec aike-postgres psql …` if you want.)

---

## 6. Provider fallback (optional, ~1 min)

Works **without** Gemini/OpenAI keys. In `.env`:

```env
LLM_PROVIDER=openai
LLM_EMBEDDING_PROVIDER=ollama
LLM_FALLBACK_ORDER=openai,ollama
LLM_TIMEOUT_MS=45000
LLM_MAX_ATTEMPTS=2
OPENAI_API_KEY=
```

Restart, ask any document question in the UI.

**Expect:** answer still arrives (via Ollama). Expand **Provider attempts** —
`#1 openai · error` (key missing), then `#2 ollama · success`. Gateway logs show
matching `attempt` / `outcome` rows. Embed stays on Ollama (`nomic-embed-text`).

**Say:** *“Generate goes through an ordered fallback chain. Embeddings stay on the
ingest provider so vector dims don’t break.”*

Switch `LLM_PROVIDER` back to `ollama` for the normal cost demo so you don’t pay
a guaranteed-fail first attempt every time.

---

## 7. Closing line (~15s)

*“RAG for correctness, gateway telemetry for cost control. Simple vs Thorough trades coverage against spend; fallback keeps generate available when a provider flakes.”*

---

## Cheat sheet

| Beat | Mode | Question | Prove |
|------|------|----------|--------|
| 1 | Simple | `what is the embedding model used in this project?` | Miss / refuse (top-2 miss the fact) |
| 2 | Thorough | Same exact question | Correct + higher cost |
| 3 | Any | Who painted the Mona Lisa? | Grounding / refuse |
| 4 | — | **Gateway logs** button | Telemetry + mode in UI |
| 5 | — | Bad primary + fallback order | **Provider attempts** + log outcomes |

**File to upload:** `demo/ai-knowledge-engine-handbook.pdf`
