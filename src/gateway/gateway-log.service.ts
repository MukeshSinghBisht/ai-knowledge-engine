import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  GatewayAttemptOutcome,
  LlmGatewayLogEntity,
} from './entities/llm-gateway-log.entity';
import {
  GatewayOperation,
  LLM_GATEWAY_OPERATION_ENUM,
} from './gateway-operation';
import { LLM_RETRIEVAL_MODE_ENUM, RetrievalMode } from './retrieval-mode';

export type GatewayLogInput = {
  requestId: string;
  operation: GatewayOperation;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  retrievalMode?: RetrievalMode | null;
  topK?: number | null;
  attempt?: number;
  outcome?: GatewayAttemptOutcome;
  failureReason?: string | null;
};

export type GatewayProviderSummary = {
  provider: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number;
  attempts: number;
  successfulAttempts: number;
  failedAttempts: number;
};

export type GatewaySummary = {
  dateUtc: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  providers: GatewayProviderSummary[];
};

export type GatewayUsageSummary = {
  today: GatewaySummary;
  allTime: GatewaySummary;
};

type GatewaySummaryRow = {
  summary_period: 'today' | 'allTime';
  provider: string | null;
  cost_usd: string;
  input_tokens: string;
  output_tokens: string;
  attempts: string;
  successful_attempts: string;
  failed_attempts: string;
  average_latency_ms: number | null;
  is_total: number;
  date_utc: string;
};

const CREATE_OPERATION_ENUM_SQL = `
DO $$ BEGIN
  CREATE TYPE ${LLM_GATEWAY_OPERATION_ENUM} AS ENUM (
    'generate',
    'tools',
    'embed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

const CREATE_RETRIEVAL_MODE_ENUM_SQL = `
DO $$ BEGIN
  CREATE TYPE ${LLM_RETRIEVAL_MODE_ENUM} AS ENUM (
    'simple',
    'thorough'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS llm_gateway_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      text NOT NULL,
  operation       ${LLM_GATEWAY_OPERATION_ENUM} NOT NULL,
  provider        text NOT NULL,
  model           text NOT NULL,
  retrieval_mode  ${LLM_RETRIEVAL_MODE_ENUM},
  top_k           int,
  attempt         int NOT NULL DEFAULT 1,
  outcome         text NOT NULL DEFAULT 'success',
  failure_reason  text,
  input_tokens    int NOT NULL DEFAULT 0,
  output_tokens   int NOT NULL DEFAULT 0,
  cost_usd        numeric(14, 8) NOT NULL DEFAULT 0,
  latency_ms      int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
`;

/** Remap legacy chat/structured → generate and rebuild the enum if needed. */
const MIGRATE_OPERATION_ENUM_SQL = `
DO $$
DECLARE
  col_udt text;
  has_legacy boolean;
  has_generate boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'llm_gateway_logs'
  ) THEN
    RETURN;
  END IF;

  SELECT udt_name INTO col_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'llm_gateway_logs'
    AND column_name = 'operation';

  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = '${LLM_GATEWAY_OPERATION_ENUM}'
      AND e.enumlabel IN ('chat', 'structured')
  ) INTO has_legacy;

  SELECT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = '${LLM_GATEWAY_OPERATION_ENUM}'
      AND e.enumlabel = 'generate'
  ) INTO has_generate;

  IF col_udt = 'text' OR has_legacy OR NOT has_generate THEN
    ALTER TABLE llm_gateway_logs
      ALTER COLUMN operation TYPE text
      USING operation::text;

    UPDATE llm_gateway_logs
    SET operation = 'generate'
    WHERE operation IN ('chat', 'structured');

    IF EXISTS (
      SELECT 1 FROM pg_type WHERE typname = '${LLM_GATEWAY_OPERATION_ENUM}'
    ) THEN
      ALTER TYPE ${LLM_GATEWAY_OPERATION_ENUM}
        RENAME TO ${LLM_GATEWAY_OPERATION_ENUM}_old;
    END IF;

    CREATE TYPE ${LLM_GATEWAY_OPERATION_ENUM} AS ENUM (
      'generate',
      'tools',
      'embed'
    );

    ALTER TABLE llm_gateway_logs
      ALTER COLUMN operation TYPE ${LLM_GATEWAY_OPERATION_ENUM}
      USING operation::${LLM_GATEWAY_OPERATION_ENUM};

    DROP TYPE IF EXISTS ${LLM_GATEWAY_OPERATION_ENUM}_old;
  END IF;
END $$;
`;

const MIGRATE_EXTRA_COLUMNS_SQL = `
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'llm_gateway_logs'
  ) THEN
    ALTER TABLE llm_gateway_logs
      ADD COLUMN IF NOT EXISTS retrieval_mode ${LLM_RETRIEVAL_MODE_ENUM};

    ALTER TABLE llm_gateway_logs
      ADD COLUMN IF NOT EXISTS top_k int;

    ALTER TABLE llm_gateway_logs
      ADD COLUMN IF NOT EXISTS attempt int NOT NULL DEFAULT 1;

    ALTER TABLE llm_gateway_logs
      ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'success';

    ALTER TABLE llm_gateway_logs
      ADD COLUMN IF NOT EXISTS failure_reason text;
  END IF;
END $$;
`;

const CREATE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_llm_gateway_logs_request_id
     ON llm_gateway_logs (request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_llm_gateway_logs_created_at
     ON llm_gateway_logs (created_at)`,
];

@Injectable()
export class GatewayLogService implements OnModuleInit {
  private readonly logger = new Logger(GatewayLogService.name);

  constructor(
    @InjectRepository(LlmGatewayLogEntity)
    private readonly logRepository: Repository<LlmGatewayLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(CREATE_OPERATION_ENUM_SQL);
    await this.dataSource.query(CREATE_RETRIEVAL_MODE_ENUM_SQL);
    await this.dataSource.query(CREATE_TABLE_SQL);
    await this.dataSource.query(MIGRATE_OPERATION_ENUM_SQL);
    await this.dataSource.query(MIGRATE_EXTRA_COLUMNS_SQL);
    for (const sql of CREATE_INDEXES_SQL) {
      await this.dataSource.query(sql);
    }
  }

  /** Persist one LLM attempt. Never throws — logging must not break the user call. */
  record(entry: GatewayLogInput): void {
    void this.persist(entry);
  }

  async listRecent(limit = 20): Promise<LlmGatewayLogEntity[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    return this.logRepository.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async getUsageSummary(): Promise<GatewayUsageSummary> {
    const rows: GatewaySummaryRow[] = await this.dataSource.query(`
      WITH periods AS (
        SELECT 'today'::text AS summary_period
        UNION ALL
        SELECT 'allTime'::text AS summary_period
      ),
      utc_day AS (
        SELECT date_trunc('day', NOW() AT TIME ZONE 'UTC') AS start_at
      )
      SELECT
        periods.summary_period,
        provider,
        COALESCE(SUM(cost_usd), 0)::text AS cost_usd,
        COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::text AS output_tokens,
        COUNT(llm_gateway_logs.id)::text AS attempts,
        COUNT(llm_gateway_logs.id) FILTER (WHERE outcome = 'success')::text AS successful_attempts,
        COUNT(llm_gateway_logs.id) FILTER (WHERE outcome <> 'success')::text AS failed_attempts,
        AVG(latency_ms)::float8 AS average_latency_ms,
        GROUPING(provider)::int AS is_total,
        to_char((NOW() AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date_utc
      FROM periods
      CROSS JOIN utc_day
      LEFT JOIN llm_gateway_logs
        ON periods.summary_period = 'allTime'
        OR (
          created_at >= utc_day.start_at AT TIME ZONE 'UTC'
          AND created_at < (utc_day.start_at + INTERVAL '1 day') AT TIME ZONE 'UTC'
        )
      GROUP BY periods.summary_period, GROUPING SETS ((provider), ())
      ORDER BY periods.summary_period, GROUPING(provider) DESC, provider ASC
    `);

    const buildSummary = (
      period: GatewaySummaryRow['summary_period'],
    ): GatewaySummary => {
      const periodRows = rows.filter((row) => row.summary_period === period);
      const total = periodRows.find((row) => row.is_total === 1);
      if (!total) {
        throw new Error(
          `Gateway ${period} summary query did not return its total row`,
        );
      }

      return {
        dateUtc: total.date_utc,
        totalCostUsd: Number(total.cost_usd),
        totalInputTokens: Number(total.input_tokens),
        totalOutputTokens: Number(total.output_tokens),
        totalAttempts: Number(total.attempts),
        successfulAttempts: Number(total.successful_attempts),
        failedAttempts: Number(total.failed_attempts),
        providers: periodRows
          .filter((row) => row.is_total === 0)
          .flatMap((row) =>
            row.provider === null
              ? []
              : [
                  {
                    provider: row.provider,
                    costUsd: Number(row.cost_usd),
                    inputTokens: Number(row.input_tokens),
                    outputTokens: Number(row.output_tokens),
                    averageLatencyMs: Number(row.average_latency_ms ?? 0),
                    attempts: Number(row.attempts),
                    successfulAttempts: Number(row.successful_attempts),
                    failedAttempts: Number(row.failed_attempts),
                  },
                ],
          ),
      };
    };

    return {
      today: buildSummary('today'),
      allTime: buildSummary('allTime'),
    };
  }

  private async persist(entry: GatewayLogInput): Promise<void> {
    try {
      await this.logRepository.save(
        this.logRepository.create({
          requestId: entry.requestId,
          operation: entry.operation,
          provider: entry.provider,
          model: entry.model,
          retrievalMode: entry.retrievalMode ?? null,
          topK: entry.topK ?? null,
          attempt: entry.attempt ?? 1,
          outcome: entry.outcome ?? 'success',
          failureReason: entry.failureReason ?? null,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          costUsd: entry.costUsd.toFixed(8),
          latencyMs: entry.latencyMs,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to write llm_gateway_logs: ${message}`);
    }
  }
}
