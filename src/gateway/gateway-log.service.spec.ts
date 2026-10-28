import { DataSource, Repository } from 'typeorm';
import { LlmGatewayLogEntity } from './entities/llm-gateway-log.entity';
import { GatewayLogService } from './gateway-log.service';

describe('GatewayLogService', () => {
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let service: GatewayLogService;

  beforeEach(() => {
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };
    const logRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<LlmGatewayLogEntity>;
    service = new GatewayLogService(
      logRepository,
      dataSource as unknown as DataSource,
    );
  });

  it('aggregates today and all-time usage by provider', async () => {
    dataSource.query.mockResolvedValue([
      {
        summary_period: 'today',
        provider: null,
        cost_usd: '0.00001840',
        input_tokens: '1200',
        output_tokens: '420',
        attempts: '3',
        successful_attempts: '2',
        failed_attempts: '1',
        average_latency_ms: 756.67,
        is_total: 1,
        date_utc: '2026-10-27',
      },
      {
        summary_period: 'today',
        provider: 'openai',
        cost_usd: '0.00001840',
        input_tokens: '1200',
        output_tokens: '420',
        attempts: '2',
        successful_attempts: '1',
        failed_attempts: '1',
        average_latency_ms: 825,
        is_total: 0,
        date_utc: '2026-10-27',
      },
      {
        summary_period: 'today',
        provider: 'ollama',
        cost_usd: '0',
        input_tokens: '0',
        output_tokens: '0',
        attempts: '1',
        successful_attempts: '1',
        failed_attempts: '0',
        average_latency_ms: 620,
        is_total: 0,
        date_utc: '2026-10-27',
      },
      {
        summary_period: 'allTime',
        provider: null,
        cost_usd: '0.00021840',
        input_tokens: '12000',
        output_tokens: '4200',
        attempts: '13',
        successful_attempts: '12',
        failed_attempts: '1',
        average_latency_ms: 856.67,
        is_total: 1,
        date_utc: '2026-10-27',
      },
      {
        summary_period: 'allTime',
        provider: 'openai',
        cost_usd: '0.00021840',
        input_tokens: '12000',
        output_tokens: '4200',
        attempts: '12',
        successful_attempts: '11',
        failed_attempts: '1',
        average_latency_ms: 875,
        is_total: 0,
        date_utc: '2026-10-27',
      },
    ]);

    await expect(service.getUsageSummary()).resolves.toEqual({
      today: {
        dateUtc: '2026-10-27',
        totalCostUsd: 0.0000184,
        totalInputTokens: 1200,
        totalOutputTokens: 420,
        totalAttempts: 3,
        successfulAttempts: 2,
        failedAttempts: 1,
        providers: [
          {
            provider: 'openai',
            costUsd: 0.0000184,
            inputTokens: 1200,
            outputTokens: 420,
            averageLatencyMs: 825,
            attempts: 2,
            successfulAttempts: 1,
            failedAttempts: 1,
          },
          {
            provider: 'ollama',
            costUsd: 0,
            inputTokens: 0,
            outputTokens: 0,
            averageLatencyMs: 620,
            attempts: 1,
            successfulAttempts: 1,
            failedAttempts: 0,
          },
        ],
      },
      allTime: {
        dateUtc: '2026-10-27',
        totalCostUsd: 0.0002184,
        totalInputTokens: 12000,
        totalOutputTokens: 4200,
        totalAttempts: 13,
        successfulAttempts: 12,
        failedAttempts: 1,
        providers: [
          {
            provider: 'openai',
            costUsd: 0.0002184,
            inputTokens: 12000,
            outputTokens: 4200,
            averageLatencyMs: 875,
            attempts: 12,
            successfulAttempts: 11,
            failedAttempts: 1,
          },
        ],
      },
    });

    const sql = dataSource.query.mock.calls[0][0];
    expect(sql).toContain("NOW() AT TIME ZONE 'UTC'");
    expect(sql).toContain(
      'GROUP BY periods.summary_period, GROUPING SETS ((provider), ())',
    );
    expect(sql).toContain("SELECT 'allTime'::text AS summary_period");
    expect(sql).toContain("outcome = 'success'");
  });

  it('returns zero totals when there are no logs', async () => {
    dataSource.query.mockResolvedValue([
      {
        summary_period: 'today',
        provider: null,
        cost_usd: '0',
        input_tokens: '0',
        output_tokens: '0',
        attempts: '0',
        successful_attempts: '0',
        failed_attempts: '0',
        average_latency_ms: null,
        is_total: 1,
        date_utc: '2026-10-27',
      },
      {
        summary_period: 'allTime',
        provider: null,
        cost_usd: '0',
        input_tokens: '0',
        output_tokens: '0',
        attempts: '0',
        successful_attempts: '0',
        failed_attempts: '0',
        average_latency_ms: null,
        is_total: 1,
        date_utc: '2026-10-27',
      },
    ]);

    const result = await service.getUsageSummary();
    expect(result.today.totalCostUsd).toBe(0);
    expect(result.today.totalAttempts).toBe(0);
    expect(result.today.providers).toEqual([]);
    expect(result.allTime.totalCostUsd).toBe(0);
    expect(result.allTime.totalAttempts).toBe(0);
    expect(result.allTime.providers).toEqual([]);
  });

  it('surfaces a missing total row instead of returning a false summary', async () => {
    dataSource.query.mockResolvedValue([
      {
        summary_period: 'today',
        provider: 'openai',
        cost_usd: '0.1',
        input_tokens: '1',
        output_tokens: '1',
        attempts: '1',
        successful_attempts: '1',
        failed_attempts: '0',
        average_latency_ms: 100,
        is_total: 0,
        date_utc: '2026-10-27',
      },
    ]);

    await expect(service.getUsageSummary()).rejects.toThrow(
      'Gateway today summary query did not return its total row',
    );
  });
});
