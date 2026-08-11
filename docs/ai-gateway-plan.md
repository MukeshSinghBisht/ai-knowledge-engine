# AI Gateway Extension — Build Plan

Next work after Phase 3 (RAG). Pace across **30–45 min sessions**.
**Gateway Phase 1 alone is a complete, demoable slice** — stop there if needed.

Interview / resume language to match job postings:

> AI Gateway / LLM cost & telemetry management

**Recorded demo:** [AIKE-GATE-TELEMETRY-DEMO2.mp4](../demo/AIKE-GATE-TELEMETRY-DEMO2.mp4) · talk track: [GATEWAY-COST-DEMO.md](../demo/GATEWAY-COST-DEMO.md)

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

## Gateway Phase 1 — Cost & latency telemetry ✅

- Wrap existing LLM provider calls in `LlmService` (generate / tools / embed).
  `/chat` and `/chat/structured` both log as `generate`.
- Per-provider **cost rates** from `.env` (not a DB table) — same pattern for all three:
  `OLLAMA_INPUT_USD_PER_1M` / `OLLAMA_OUTPUT_USD_PER_1M`,
  `OPENAI_INPUT_USD_PER_1M` / `OPENAI_OUTPUT_USD_PER_1M`,
  `GEMINI_INPUT_USD_PER_1M` / `GEMINI_OUTPUT_USD_PER_1M`
  with defaults in `DEFAULT_COST_RATES` (`src/gateway/llm-cost.ts`).
  Ollama rates are demo assumptions (local is free in reality).
- Log every call to **`llm_gateway_logs`**: provider, tokens, `cost_usd`, `latency_ms`,
  `retrieval_mode` / `top_k` (when from `/query`), timestamp, `request_id`.
- `/chat` and `/query` responses include `requestId`, `costUsd`, `latencyMs` (API JSON; same values as the log row).
- One `/query` uses the **same `requestId`** for retrieve (embed) + generate (chat).

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
