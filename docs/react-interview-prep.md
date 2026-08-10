# React prep — interview refresh (not a frontend project)

Light refresh so you can answer React questions credibly. **Do not** go beyond this list.
Practice **inside this repo’s chat UI**, not a separate tutorial app.

Today the UI is vanilla HTML/JS: [`public/index.html`](../public/index.html).
The refresh is: rebuild **the same** upload → ask → answer + sources flow in React
(functional components). That is also the story for:

> “Tell me about a time you built a frontend for one of your projects.”

Walk through **state decisions**, not “I built a UI.”

---

## When (pacing)

- **Primary build time** stays on **AI Gateway 4.1** (backend).
- Use **interview 30 min** slots (or a Sunday hour) for React.
- Do **not** pause the gateway to become a frontend specialist.

---

## Core hooks (the actual gap)

| Hook | What to be able to say |
|------|-------------------------|
| **useState** | Basic state; updates are **async/batched** — “why doesn’t my state update immediately?” |
| **useEffect** | Dependency array, cleanup, classic **infinite loop** (missing/wrong deps) |
| **useContext** | Avoid prop-drilling; when Context is enough vs a state library |
| **useMemo / useCallback** | Why they exist (skip extra re-renders / re-created functions) — not deep perf mastery |

## Component patterns

- Functional components are the default (biggest shift if last work was class-based)
- Controlled vs uncontrolled form inputs
- Conditional rendering: ternary, `&&`, early returns

## State management — recognition only, not mastery

| Tool | Enough to say |
|------|----------------|
| **Zustand** | Lightweight hook-based global state; how it differs from Context |
| **TanStack Query (React Query)** | Server-state: fetch / cache / refetch; **server state ≠ client state** |
| **Redux** | Awareness that it’s less dominant now; no depth |

## Skip entirely

- Class components / lifecycle methods
- Deep animation libraries, complex routing edge cases
- Angular, Ionic, React Native

---

## Practice in this chat UI (that’s the whole drill)

Rebuild `public/index.html` as a small React client (Vite is fine; keep it tiny).

| Touch | Maps to |
|-------|---------|
| Loading spinner while `/query` runs | `useState` |
| Messages list + “ask” submit | controlled input + conditional render |
| Fetch/display chat history on mount (even in-memory or `localStorage` at first) | `useEffect` + cleanup |
| Share messages without prop-drilling 3 levels | `useContext` (or mention Zustand if you add it) |
| Don’t recreate handlers every render on a list | one `useCallback` / `useMemo` you can explain |

That’s most of the list in a **real, demoable** context.

**Out of scope for this UI:** routing edge cases, animation libs, a design system, SSR.

---

## One interview answer to rehearse

**Q:** Tell me about a time you built a frontend for one of your projects.

**Shape:** RAG Knowledge Engine chat UI — upload PDF, ask a question, show answer + sources.
Mention: messages as client state (`useState`), loading while the API runs, effect to restore
history, Context vs Zustand if you used either, and that **server state** (documents/invoices)
would be React Query in a larger app. Close with: backend owns RAG; UI is a thin client.
