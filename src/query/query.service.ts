import { Injectable } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { SearchResultDto } from '../documents/dto/document-response.dto';
import { LlmService } from '../llm/llm.service';
import { QueryDto } from './dto/query.dto';
import { QueryResponseDto } from './dto/query-response.dto';

/**
 * The grounding contract: the model must answer ONLY from the context we give it.
 * This is what turns a chatbot into a RAG system — no outside knowledge, no guessing,
 * and it must admit when the answer isn't in the documents.
 */
const SYSTEM_PROMPT = [
  'You are a knowledge assistant. Answer the user question using ONLY the numbered',
  'context sources provided below. Do not use any outside knowledge.',
  "If the answer is not contained in the sources, reply exactly: \"I don't know based on the available documents.\"",
  'Keep the answer concise and factual. When useful, refer to sources like [Source 1].',
].join(' ');

@Injectable()
export class QueryService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly llmService: LlmService,
  ) {}

  async answer(dto: QueryDto): Promise<QueryResponseDto> {
    const topK = dto.topK ?? 4;

    // 1. Retrieve: reuse the same embedding + cosine search as /search.
    const { results } = await this.documentsService.search({
      query: dto.query,
      topK,
    });

    // 2. No context found → don't call the LLM; there's nothing to ground on.
    if (results.length === 0) {
      return {
        answer: "I don't know based on the available documents.",
        grounded: false,
        sources: [],
        model: '-',
        provider: this.llmService.activeProvider,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    // 3. Augment: stuff the retrieved chunks into the prompt as numbered sources.
    const context = results
      .map(
        (source: SearchResultDto, i: number) =>
          `[Source ${i + 1}] (${source.title})\n${source.content}`,
      )
      .join('\n\n');

    // 4. Generate: the LLM answers grounded in that context.
    const result = await this.llmService.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${dto.query}`,
      },
    ]);

    return {
      answer: result.reply,
      grounded: true,
      sources: results,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
    };
  }
}
