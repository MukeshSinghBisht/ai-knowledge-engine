# AI Gateway Extension — Build Plan

Gateway telemetry and fallback are complete; the cost summary API is implemented.
Remaining gateway work: Redis-backed per-user/API-key rate limiting. Pace across **30–45 min sessions**.

Interview / resume language to match job postings:

> AI Gateway / LLM cost & telemetry management

**Recorded demo:** [AIKE-GATE-TELEMETRY-DEMO2.mp4](../demo/AIKE-GATE-TELEMETRY-DEMO2.mp4) · talk track: [GATEWAY-COST-DEMO.md](../demo/GATEWAY-COST-DEMO.md)

---

## Why the gateway

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

## Gateway Phase 2 — Automatic fallback ✅

- Fallback order (config): `LLM_FALLBACK_ORDER` (e.g. **ollama,gemini,openai**).
  Primary is always `LLM_PROVIDER`, then unique names from the list.
- Each generate attempt uses a **timeout** (`LLM_TIMEOUT_MS`, default 10s).
- On timeout/error, retry the next provider (capped by `LLM_MAX_ATTEMPTS`).
- Log each attempt: `attempt`, `outcome` (`success` \| `timeout` \| `error`), `failure_reason`.
- API responses include `attempts[]` (UI shows a collapsed “Provider attempts” panel).
- **Embeddings** use `LLM_EMBEDDING_PROVIDER` (defaults to `LLM_PROVIDER`) and
  **do not fall back** across providers (vector dims must match ingest).
  Demo tip: `LLM_PROVIDER=openai` + empty key + `LLM_EMBEDDING_PROVIDER=ollama`
  exercises generate fallback while RAG still embeds locally.

**Done when:** you can kill/timeout the primary provider and still get an answer + logs
that show fallback; all failures → 503.

---

## Gateway Phase 3 — Rate limiting (per user / tenant)

- Redis counter per user or API key (introduces Redis early; BullMQ can reuse it later).
- Basic limit (e.g. **X requests/minute**) to simulate multi-tenant cost control.
- Return a clear **429 rate-limit-exceeded** body — never fail silently.

**Done when:** exceeding the limit returns 429; under the limit still hits the gateway.

---

## Gateway Phase 4 — Cost dashboard / summary endpoint ✅

`GET /gateway/summary` returns one JSON summary (no UI):

- Total cost and attempt counts **today (UTC)**
- Cost, attempt outcomes, and average latency **by provider**
- Latency averages include failed attempts; costs sum each recorded provider attempt, including retries
- Optional: cost **by user/tenant** if Phase 3 is in place

**Verified by:** querying `GET /gateway/summary` after `/query` calls and comparing its
aggregates against `llm_gateway_logs` for the same UTC day.

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

Do **not** start those until the gateway summary is verified against live log data and
the planned per-user/API-key quota is complete or explicitly deferred.

**React interview refresh** is parallel (30 min), not a gateway blocker. See [react-interview-prep.md](./react-interview-prep.md).
