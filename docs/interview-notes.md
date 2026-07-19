# Interview notes

Add 5–10 bullet answers here after each study session (30 min/day).

## Week 1

### Tokens

- Small pieces of text the AI uses to read/write (not always whole words).
- Used for **billing**, **limits**, and measuring prompt size.
- Example: `promptTokens` = what we sent, `completionTokens` = the reply.

### Context window

- **Max tokens the model can handle in one request** (input + room for output).
- Not the same as `max_tokens` (which caps **only** the reply length).
- If you paste too much text, it errors or gets cut off — that’s why we chunk documents in RAG.

### Embeddings

- Turn **text into a list of numbers** (a vector) that captures **meaning**.
- Similar meaning → similar numbers → we find the right paragraph with **vector search** (not keyword match).
- Same embedding model for storing docs and for search queries.

### RAG flow (shop PDF example)

- **Upload (once):** PDF → split into chunks → embed each chunk → store text + vectors in DB.
- **Query (each time):** customer question → embed question → find closest chunks → send chunk text + question to LLM → answer.
- We don’t send the whole PDF every time — only the **top matching paragraphs**.

### Prompt vs completion tokens (from `/chat` response)

- **Prompt tokens:** system message + user message (input).
- **Completion tokens:** the `reply` field only (output).
- **Total:** both added together.
- Context window = shared budget (input + output)
- Embeddings = meaning-based search, not keyword match
- Your flow: `Controller → ChatService → LlmService → Provider`
- System prompt is server-side in `ChatService`, not from client
- Extra DTO fields → 400 via `forbidNonWhitelisted`
- All providers return `ChatResult` so the API stays provider-agnostic

- Structured output = LLM as a **step in a pipeline**, not only a chat widget
- Use when downstream code needs **fields**, not paragraphs
- Always **validate output**; use confidence thresholds for automation
- In my project: metadata at ingest, optional query planning before RAG, safety before index

### Tool / function calling

- A **tool** = a backend function I expose to the model as a **description** (name + args), not the code itself.
- Two separate parts: **definition** (schema the model sees) vs **handler** (the real code only my backend runs).
- The model can only **request** a call; **my backend decides** whether to run it → security boundary ("model proposes, code disposes").
- It's a **loop over a growing `messages` array**: model asks for tool → I run it → append result as `role:"tool"` → re-send everything → model gives final answer.
- Model is **stateless**: every round I re-send the full history (tool results included). Ties back to context window.
- Always guard the loop with **maxRounds** (I used 5) — never trust an external system to terminate.
- **Structured output vs tool calling:** structured = shape of the *answer*; tool = the model *triggers an action* and continues with the result.
- **When model answers alone:** general knowledge / reasoning. **When a tool is needed:** live data (today's date), exact math (word count), or an action in my system.
- My `/chat/tools` demo tools: `getCurrentDate` (no args) and `countWords({text})`; response returns `toolsUsed` to prove the model actually called code.
- **Real lesson from testing:** on `llama3.2` (small local model), a general-knowledge question ("what is RAG?") sometimes **over-called a tool and hallucinated**. The loop worked fine — it's a **model-quality** issue. Bigger models (GPT-4o-mini/Gemini) decide tool-use more reliably.
- Basic RAG does **not** need tool calling (my backend does retrieval). Tools only matter for **agentic RAG**, where the model decides when/what to search.

