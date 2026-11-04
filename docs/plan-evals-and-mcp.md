# Plan — Evaluation pipeline and MCP server

**Status:** Planned (2026-11-04). Requirements: [BRD §7.10 and §7.11](./BRD.md). Broader schedule: [ai-engineering-roadmap.md](./ai-engineering-roadmap.md) (its original dates have slipped; this plan replaces them for these two items).

**Cadence:** 30–45 minute sessions, about three per week. Dates are targets; move unfinished work forward and record actual progress in the log at the bottom instead of marking items done early.

## Order and why

1. **Evaluation first.** It gives numbers for every later change (top-K, model, prompt) and supports both the job search and the product.
2. **MCP second.** It is a thin read-only wrapper over existing services, so it is cheap once search and query behavior is measured.
3. Redis per-key quota (FR-GW-08b) and the WhatsApp channel (BRD §15) follow; remote MCP waits for authentication and per-client quotas.

## Part A — Evaluation pipeline (BRD §7.10)

| Session | Target date | Work | Done when |
|---|---|---|---|
| A1 | 2026-11-05 | Write `evals/golden.jsonl`: 20–30 cases from the handbook and sample documents. Mix exact-term, paraphrase, multi-chunk, no-answer and a few Hindi/Hinglish cases. | File committed; each case has `expected_doc`, `must_contain`, `should_refuse`, `category`. |
| A2 | 2026-11-07 | Build `evals/run.ts`: call `/query` in Simple and Thorough modes, record sources, answer, latency, `requestId`. | Runner completes against a local database and writes a JSON result file. |
| A3 | 2026-11-10 | Add metrics: retrieval hit rate, answer support, p50/p95 latency, cost per question (join `llm_gateway_logs` on `requestId`). | Markdown report generated in `evals/results/`. |
| A4 | 2026-11-12 | Safety tests as Jest cases: prompt injection inside an uploaded document, and unsupported-answer cases. | `npm test` passes; failing behavior is visible, not hidden. |
| A5 | 2026-11-14 | Run the baseline, label each miss as retrieval or generation failure, save the first report. | Baseline report committed with Simple vs Thorough numbers. |
| A6 | 2026-11-17 | Optional: compare against the previous run; add Hinglish cases from real questions. | Report shows deltas. |

**Rules:**
- Run evaluations against a local database or a dedicated session, never against the public demo quota.
- Do not claim a quality improvement without a before/after run on the same cases.
- Keep any LLM-as-judge scoring optional and later; the rule-based checks come first.

## Part B — MCP server (BRD §7.11)

| Session | Target date | Work | Done when |
|---|---|---|---|
| B1 | 2026-11-19 | Scope and design: confirm the four read-only tools, argument schemas and where the server calls into existing services. Add the official MCP SDK dependency. | Short design note in this file; no write tools. |
| B2 | 2026-11-21 | MVP: stdio server with `search_documents`, validated arguments. | An MCP client can initialize, discover and call the tool. |
| B3 | 2026-11-24 | Add `ask_knowledge_base`, `list_documents`, `gateway_summary`; route through existing services so gateway logs carry a `requestId`. | All tools return the same data shapes as the HTTP API. |
| B4 | 2026-11-26 | Protocol tests: initialize, discovery, valid call, invalid arguments, error paths. | Tests pass; errors are clean MCP errors. |
| B5 | 2026-11-28 | README section and a short client demo (setup steps, supported clients, limitations). | Demo recorded; limitations stated plainly. |

**Rules:**
- Read-only: no upload, delete or write tools (FR-MCP-05, FR-SAFE-03).
- Local stdio first. Do not claim hosted multi-client support until authentication and per-client quotas exist (FR-MCP-08).
- MCP is different from the existing function-calling demo (`POST /chat/tools`); document the difference in the README.

## Risks

| Risk | Mitigation |
|---|---|
| Eval set is small or self-written, so scores look flattering | Include no-answer and real user questions; grow it from the unanswered-question log |
| Free-tier quotas interrupt long evaluation runs | Run locally with Ollama, or throttle the runner; log the provider used in every report |
| Scope creep into frameworks or orchestration | Finish A and B first; add orchestration only if a measured gap needs it |

## Progress log

| Date | Session | Notes |
|---|---|---|
| 2026-11-04 | Planning | BRD v1.2 and this plan written; no code yet. |
