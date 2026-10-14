import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DemoAnalyticsService } from '../demo-analytics/demo-analytics.service';
import { DocumentsService } from '../documents/documents.service';
import { SearchResultDto } from '../documents/dto/document-response.dto';
import { RETRIEVAL_MODE_TOP_K } from '../gateway/retrieval-mode';
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
  'If the answer is not contained in the sources, reply exactly: "I don\'t know based on the available documents."',
  'Use the EXACT names, numbers, and terms as they appear in the sources — copy proper',
  'nouns and product/model names verbatim and do NOT paraphrase, generalize, or',
  'substitute a broader term for a specific one (for example, do not replace a specific',
  'model name with the tool that runs it).',
  'Keep the answer to one or two sentences, factual, with no meta commentary about the',
  'sources themselves.',
].join(' ');

const MAX_QUERIES_PER_SESSION = 5;
const QUERY_QUOTA_RETENTION_DAYS = 7;

const CREATE_QUERY_USAGE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS demo_query_usage (
  session_id  text PRIMARY KEY,
  query_count int NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL
);
`;

@Injectable()
export class QueryService implements OnModuleInit {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly llmService: LlmService,
    private readonly dataSource: DataSource,
    private readonly demoAnalytics: DemoAnalyticsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(CREATE_QUERY_USAGE_TABLE_SQL);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_demo_query_usage_expires_at
       ON demo_query_usage (expires_at)`,
    );
  }

  async answer(dto: QueryDto, sessionId: string): Promise<QueryResponseDto> {
    await this.demoAnalytics.recordActivity(sessionId, 'query');
    await this.consumeQueryAllowance(sessionId);

    const requestId = randomUUID();
    const mode = dto.mode ?? null;
    const topK = dto.topK ?? (mode ? RETRIEVAL_MODE_TOP_K[mode] : 4);
    const callOptions = {
      requestId,
      retrievalMode: mode ?? undefined,
      topK,
    };

    // 1. Retrieve: reuse the same embedding + cosine search as /search.
    const { results } = await this.documentsService.search(
      {
        query: dto.query,
        topK,
      },
      { ...callOptions, sessionId },
    );

    // 2. No context found → don't call the LLM; there's nothing to ground on.
    if (results.length === 0) {
      return {
        answer: "I don't know based on the available documents.",
        grounded: false,
        sources: [],
        model: '-',
        provider: this.llmService.activeProvider,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        requestId,
        costUsd: 0,
        latencyMs: 0,
        mode,
        topK,
        attempts: [],
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
    const result = await this.llmService.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${dto.query}`,
        },
      ],
      callOptions,
    );

    return {
      answer: result.reply,
      grounded: true,
      sources: results,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      requestId: result.requestId,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      mode,
      topK,
      attempts: result.attempts,
    };
  }

  private async consumeQueryAllowance(sessionId: string): Promise<void> {
    await this.dataSource.query(
      'DELETE FROM demo_query_usage WHERE expires_at <= now()',
    );

    const rows = await this.dataSource.query<{ query_count: number }[]>(
      `INSERT INTO demo_query_usage (session_id, query_count, expires_at)
       VALUES ($1, 1, now() + interval '${QUERY_QUOTA_RETENTION_DAYS} days')
       ON CONFLICT (session_id) DO UPDATE
       SET query_count = CASE
             WHEN demo_query_usage.expires_at <= now() THEN 1
             ELSE demo_query_usage.query_count + 1
           END,
           expires_at = CASE
             WHEN demo_query_usage.expires_at <= now()
               THEN now() + interval '${QUERY_QUOTA_RETENTION_DAYS} days'
             ELSE demo_query_usage.expires_at
           END
       WHERE demo_query_usage.expires_at <= now()
          OR demo_query_usage.query_count < $2
       RETURNING query_count`,
      [sessionId, MAX_QUERIES_PER_SESSION],
    );

    if (rows.length === 0) {
      throw new HttpException(
        `Demo limit reached: you can ask up to ${MAX_QUERIES_PER_SESSION} questions per browser session. The limit resets after ${QUERY_QUOTA_RETENTION_DAYS} days.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
