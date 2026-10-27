# AI Knowledge Engine — Job-Ready Roadmap

**Tracker started:** 2026-10-01<br>
**Cadence:** three focused sessions per week, 30–45 minutes each. Dates are targets; record actual progress in the log below and move unfinished work forward instead of marking it done.

This roadmap combines the existing AI Gateway plan with the newer evaluation, observability, orchestration, MCP, safety, and job-market recommendations. It targets applied AI / LLM application engineering, not ML research. Core job-search work remains the priority; use the existing job-search/GitHub time block for these sessions.

## Current Status

Status meanings: **Done** = present and demonstrable in the repository; **Partial** = some relevant implementation exists, but the planned outcome is incomplete; **Not started** = no implementation or evidence found in the workspace as of 2026-10-01.

| Area | Status | Evidence / remaining work |
|---|---|---|
| RAG API, pgvector, document upload, deduplication, citations | Done | Existing API and README describe the end-to-end flow. |
| AI Gateway telemetry and provider fallback | Done | Gateway logs/cost/latency and fallback are implemented; existing gateway plan marks them complete. |
| Global IP-based request throttling | Done | Nest throttler is registered globally in `src/app.module.ts`. |
| Redis-backed per-API-key/user quota | Not started | This is distinct from the existing IP throttle; add identity validation before trusting a key. |
| Gateway cost summary endpoint | Done | `GET /gateway/summary` aggregates today's UTC cost, attempts, outcomes, and average latency by provider. |
| RAG evaluation suite | Not started | No golden dataset or repeatable evaluation runner found. |
| Safety / prompt-injection evaluation | Not started | Add tests for untrusted retrieved text, unsupported answers, and tool permissions. |
| Langfuse / OpenTelemetry traces | Partial | Application telemetry exists in Postgres; external trace/span integration is not present. |
| MCP server | Not started | Existing function calling is a separate mechanism, not MCP; current tools are limited and provider-specific. |
| LangGraph orchestration | Not started | Current fallback chain is custom and simple. Do not replace it just to add a framework; first define a multi-step workflow that benefits from graph state/branching. |
| Context management and cost optimization | Partial | Token/cost estimates exist; context budgeting, cache/routing experiments, and measured savings do not. |
| Incident simulation and write-up | Partial | Timeout/fallback paths exist; a repeatable injected-failure exercise and incident record remain. |
| Python, CI/CD, cloud deployment evidence | Not started | The application is TypeScript/NestJS. Add a small Python artifact and deployment/CI evidence for broader AI-engineering roles. |
| Fine-tuning | Not started; optional | Defer unless target roles or evaluation results give a specific reason. |
| README, demos, and portfolio positioning | Partial | Existing demos/docs are useful; update them as new milestones land and correct stale “next” status. |

## Schedule

Each row is one 30–45 minute session. Deliverables are intentionally small; a phase is complete only when its exit check passes.

| Date | Session focus | Deliverable / exit check | Status |
|---|---|---|---|
| 2026-10-02 | Define evaluation scope | Choose 20–30 representative RAG questions; define expected answer facts, source requirements, and abstention cases. | Not started |
| 2026-10-05 | Build the golden set | Add versioned JSON cases, including exact-term/policy-number and no-answer cases. | Not started |
| 2026-10-07 | Baseline evaluation | Add a repeatable runner; record answer support/citation pass rate, retrieval hit rate, latency, and cost baseline. | Not started |
| 2026-10-09 | Failure analysis | Review misses, label retrieval vs generation failures, and save a short baseline report. | Not started |
| 2026-10-12 | Safety test cases | Add prompt-injection-in-document and unsupported-answer cases; test that retrieved text is treated as data, not instructions. | Not started |
| 2026-10-14 | Tool safety boundary | Document allowed tools and add negative tests for malformed/unauthorized tool requests; no destructive tools in the demo. | Not started |
| 2026-10-16 | Quota identity design | Decide API-key identity, hashing/storage, trusted proxy behavior, quota window, and error body before coding. | Not started |
| 2026-10-19 | Redis quota implementation | Add shared Redis counter and configuration; keep the existing IP throttle as a separate outer limit. | Not started |
| 2026-10-21 | Quota verification | Test under-limit/over-limit behavior and expiry; return a stable 429 `rate-limit-exceeded` response. | Not started |
| 2026-10-23 | Gateway summary query | Define the daily boundary/time zone and aggregation shape for total cost, cost by provider, and average latency. | Not started |
| 2026-10-26 | Summary endpoint | Implement `GET /gateway/summary`; aggregate from gateway logs, not client-supplied values. | Done — implemented 2026-10-27 |
| 2026-10-28 | Summary tests and docs | Verify summary against seeded/logged calls; document example response and update README gateway status. | Done — focused tests and docs completed 2026-10-27 |
| 2026-10-30 | MCP scope and architecture | Select read-only knowledge-base tools (for example search and document metadata); map host/client/server and data-access boundaries. | Not started |
| 2026-11-02 | MCP server MVP | Implement a standards-based TypeScript MCP server exposing one validated read-only tool. | Not started |
| 2026-11-04 | MCP protocol tests | Verify initialization, tool discovery, valid calls, invalid arguments, and errors with an MCP inspector/client. | Not started |
| 2026-11-06 | MCP integration | Connect the MCP tool to the existing search/query service without bypassing validation or tenant boundaries. | Not started |
| 2026-11-09 | MCP security and transport | Document local stdio first; review remote transport/auth separately before claiming hosted multi-client support. | Not started |
| 2026-11-11 | MCP demo | Record a short client demo and document supported clients, setup, limitations, and tool-discovery flow. | Not started |
| 2026-11-13 | Observability design | Map existing request IDs/log fields to traces/spans; decide what sensitive prompt/document data must not be exported. | Not started |
| 2026-11-16 | Langfuse integration | Trace one RAG request end-to-end (retrieve/embed/generate/fallback) with safe metadata and configuration. | Not started |
| 2026-11-18 | Trace verification | Confirm failures and provider attempts are visible; document sampling, retention, and local/no-key behavior. | Not started |
| 2026-11-20 | Orchestration use case | Identify a real multi-step workflow with state/branching; compare a small deterministic implementation with LangGraph. | Not started |
| 2026-11-23 | LangGraph prototype | Build only the workflow if graph state/branching provides value; keep provider fallback in its current gateway responsibility. | Not started |
| 2026-11-25 | Orchestration decision | Add tests for retries, timeout, branch, and state; document why LangGraph or custom code is the better fit. | Not started |
| 2026-11-27 | Cost/context experiment | Pick a representative workload and establish a measured quality/cost/latency baseline. | Not started |
| 2026-11-30 | Optimization experiment | Test one change only (context trimming, caching, or model routing); include cache invalidation and tenant-key concerns if caching. | Not started |
| 2026-12-02 | Incident exercise | Inject provider timeout or malformed output; capture detection, impact, root cause, fix, and prevention in an incident note. | Not started |
| 2026-12-04 | Python bridge | Create a small Python evaluation client/runner against the API; explain what transfers from the TypeScript service. | Not started |
| 2026-12-07 | Delivery readiness | Add/verify automated build, tests, Docker run instructions, health check, and a deployment target or reproducible local deploy. | Not started |
| 2026-12-09 | Portfolio refresh | Update architecture diagram, demos, README, and resume bullets with measured outcomes; mark unfinished roadmap items honestly. | Not started |

## Priority Rules

1. Finish evaluation and safety checks before claiming quality improvements; use the same cases to compare changes.
2. Complete the pending API-key quota and summary endpoint from the existing gateway plan before adding more infrastructure.
3. Build a focused MCP demo before introducing an orchestration framework. MCP tool exposure is not the same as LLM function calling.
4. Add LangGraph only for a workflow that benefits from explicit state and branching; do not rewrite the simple provider fallback solely for résumé keywords.
5. Keep fine-tuning optional. Consider it only for a target role or measured use case that prompting/RAG cannot satisfy.
6. Update README/demo after each finished milestone rather than waiting for the final week.

## Hiring-Signal Notes

The supplied claim that 39.6% of roles require evaluations and Python appears in 82.5% was not confirmed from the linked sources. The public [AI Engineering Field Guide job analysis](https://github.com/alexeygrigorev/ai-engineering-field-guide/blob/main/role/02-skills.md) reports its methodology and a dataset of 6,964 postings scraped February–August 2026: Python is listed in 70.8% of all analyzed postings (75.6% of AI-first roles), evaluation-related skills in 59.7% of AI-first roles, MCP in 14.1% of postings, and fine-tuning as the primary responsibility in 3.6% of postings. Treat these as directional for that dataset, not universal global rates. The [Stack Overflow 2025 AI survey](https://survey.stackoverflow.co/2025/ai) reports broad AI-tool adoption but also low confidence in output, reinforcing the value of verification and testing. A single consultancy blog's skill ranking is a useful hypothesis, not independently validated job-posting statistics.

## Progress Log

Append one line after each session. Record blockers and actual evidence; do not change a status to Done until the exit check passes.

| Date | Planned item | Outcome / evidence | Next action |
|---|---|---|---|
| 2026-10-01 | Initial repository audit | Telemetry/fallback and global IP throttle confirmed; Redis per-key quota, summary endpoint, eval suite, MCP, external tracing not found. Existing `.gitignore` user change left untouched. | Start session 1 on 2026-10-02. |
| 2026-10-27 | Gateway summary API | Added UTC-day cost totals and provider attempt, outcome, and average-latency breakdown; focused gateway tests and build pass. | Design Redis-backed API-key quota identity and limit. |

### Session update template

`YYYY-MM-DD — Item: Done / Partial / Blocked. Evidence: ... Next: ...`