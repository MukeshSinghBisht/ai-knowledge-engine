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
