# Demo Script — AI Gateway Cost & Simple vs Thorough

**Audience:** interview / portfolio walkthrough (~6–8 min)  
**UI:** http://localhost:3000 (or http://localhost:3001 if 3000 is busy)  
**Goal:** show RAG grounding **and** gateway telemetry (cost, latency, retrieval depth).

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
**Ask:** `What embedding model does this project use and how many dimensions?`

**What to point at under the answer:**
- Sources (expand one)
- Meta: `Simple · topK 2 · … · $… · requestId`

**Say:** *“Simple only pulls the top 2 chunks — cheaper, but it can miss the answer if the fact isn’t in those hits.”*

> If Simple says “I don’t know”, that’s a **feature for the next beat** — don’t panic. Open Source 1/2 and show they don’t name `nomic-embed-text`.

---

## 3. Same question, Thorough (~1–2 min) — cost contrast

**Mode:** Thorough  
**Ask the same question again.**

**Expect:** correct answer (`nomic-embed-text`, 768 dims), more sources, **higher `$` cost**.

**Say:**  
*“Thorough uses 12 chunks. More context → more prompt tokens → higher estimated cost. Same question, different spend — that’s a real product knob (quick FAQ vs deep research).”*

Compare the two `$` values on screen.

---

## 4. Guardrail / no hallucinate (~45s)

**Mode:** either  
**Ask:** `Who painted the Mona Lisa?`

**Expect:** *I don't know based on the available documents.*  
(Handbook mentions this example; still a strong “we don’t invent” moment.)

**Say:** *“Even if the model knows the answer from training data, the system prompt forces grounding. No source → refuse.”*

---

## 5. Gateway logs (optional, ~1 min)

If you have a DB client / `psql`:

```sql
SELECT request_id, operation, retrieval_mode, top_k, cost_usd, latency_ms
FROM llm_gateway_logs
ORDER BY created_at DESC
LIMIT 12;
```

**Point out:**
- One UI ask → rows for `embed` + `generate` sharing the same `request_id`
- `retrieval_mode` = `simple` / `thorough`
- `top_k` = 2 / 12
- `cost_usd` / `latency_ms` match what the UI showed

**Say:** *“This is the AI Gateway layer — every LLM call is metered for cost and latency, not just answered.”*

---

## 6. Closing line (~15s)

*“RAG for correctness, gateway telemetry for cost control. Simple vs Thorough is how a product lets users trade accuracy/coverage against spend.”*

---

## Cheat sheet

| Beat | Mode | Question | Prove |
|------|------|----------|--------|
| 1 | Simple | Embedding model + dimensions? | Cheap path; may miss |
| 2 | Thorough | Same question | Correct + higher cost |
| 3 | Any | Who painted the Mona Lisa? | Grounding / refuse |
| 4 | — | SQL on `llm_gateway_logs` | Telemetry + mode in DB |

**File to upload:** `demo/ai-knowledge-engine-handbook.pdf`
