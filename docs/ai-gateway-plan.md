# AI Gateway Extension — Build Plan

Next work after Phase 3 (RAG). Pace across **30–45 min sessions**.
**Gateway Phase 1 alone is a complete, demoable slice** — stop there if needed.

Interview / resume language to match job postings:

> AI Gateway / LLM cost & telemetry management

---

## Why this next

The RAG API already switches Ollama / Gemini / OpenAI. Production hiring wants the layer
*around* those calls: **cost, latency, fallback, rate limits** — not another chat endpoint.

```text
Controller → Query/Chat service → AI Gateway → provider (Ollama | Gemini | OpenAI)
                              ↓
                     llm_gateway_logs (Postgres)
```

---

## Gateway Phase 1 — Cost & latency telemetry

- Wrap existing LLM provider calls in a **single gateway function** (no direct provider
  calls from chat/query/embed).
- Per-provider cost table: OpenAI + Gemini input/output token pricing; **Ollama = $0**,
  track **compute time** instead.
- Log every call: provider, input tokens, output tokens, calculated cost, latency, timestamp.
- Store in **`llm_gateway_logs`** (same Postgres as RAG).
- Add **`requestId`** on each log row to trace back to the original user query.

**Done when:** `/chat` and `/query` go through the gateway; you can query logs and explain
cost vs latency for one request.

---

## Gateway Phase 2 — Automatic fallback

- Fallback order (config): e.g. **OpenAI → Gemini → Ollama**.
- Primary call in try/catch with a **timeout** (e.g. 10s).
- On timeout/error, retry the next provider.
- Log which attempt succeeded (**primary vs fallback**) and why the previous failed.
- **Max-retry limit** so it does not loop if all providers fail.

**Done when:** you can kill/timeout the primary provider and still get an answer + a log
that shows fallback.

---

## Gateway Phase 3 — Rate limiting (per user / tenant)

- Redis counter per user or API key (introduces Redis early; BullMQ can reuse it later).
- Basic limit (e.g. **X requests/minute**) to simulate multi-tenant cost control.
- Return a clear **429 rate-limit-exceeded** body — never fail silently.

**Done when:** exceeding the limit returns 429; under the limit still hits the gateway.

---

## Gateway Phase 4 — Cost dashboard / summary endpoint

One JSON GET (no UI yet):

- Total cost **today**
- Cost **by provider**
- Average **latency by provider**
- Optional: cost **by user/tenant** if Phase 3 is in place

Suggested: `GET /gateway/summary` (or `/metrics/llm`).

**Done when:** after a few `/query` calls, the endpoint matches what you see in
`llm_gateway_logs`.

---

## Gateway Phase 5 — Documentation & positioning

- README: **AI Gateway** section — routing, fallback, cost tracking.
- Short **60–90s** follow-up demo: fallback triggering + summary endpoint.
- Resume / LinkedIn line: **AI Gateway / LLM cost & telemetry management**.
- Optional post: *I added an AI Gateway to my RAG system — here's why cost tracking
  and fallback matter in production.*

---

## After the gateway (still planned)

| Phase | Focus |
|-------|--------|
| 5 | Async ingestion (BullMQ + Redis workers) |
| 6 | SSE streaming RAG |
| 7 | JWT, multi-tenant isolation, audit |

Do **not** start those until Gateway Phase 1 is demoable (or you explicitly skip).

**React interview refresh** is parallel (30 min), not a gateway blocker. See [react-interview-prep.md](./react-interview-prep.md).
