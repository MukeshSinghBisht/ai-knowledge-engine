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

  it('aggregates today’s UTC cost, attempts, and latency by provider', async () => {
    dataSource.query.mockResolvedValue([
      {
        provider: null,
        cost_usd: '0.00001840',
        attempts: '3',
        successful_attempts: '2',
        failed_attempts: '1',
        average_latency_ms: 756.67,
        is_total: 1,
        date_utc: '2026-10-27',
      },
      {
        provider: 'openai',
        cost_usd: '0.00001840',
        attempts: '2',
        successful_attempts: '1',
        failed_attempts: '1',
        average_latency_ms: 825,
        is_total: 0,
        date_utc: '2026-10-27',
      },
      {
        provider: 'ollama',
        cost_usd: '0',
        attempts: '1',
        successful_attempts: '1',
        failed_attempts: '0',
        average_latency_ms: 620,
        is_total: 0,
        date_utc: '2026-10-27',
      },
    ]);

    await expect(service.getTodaySummary()).resolves.toEqual({
      dateUtc: '2026-10-27',
      totalCostUsd: 0.0000184,
      totalAttempts: 3,
      successfulAttempts: 2,
      failedAttempts: 1,
      providers: [
        {
          provider: 'openai',
          costUsd: 0.0000184,
          averageLatencyMs: 825,
          attempts: 2,
          successfulAttempts: 1,
          failedAttempts: 1,
        },
        {
          provider: 'ollama',
          costUsd: 0,
          averageLatencyMs: 620,
          attempts: 1,
          successfulAttempts: 1,
          failedAttempts: 0,
        },
      ],
    });

    const sql = dataSource.query.mock.calls[0][0];
    expect(sql).toContain("NOW() AT TIME ZONE 'UTC'");
    expect(sql).toContain('GROUP BY GROUPING SETS ((provider), ())');
    expect(sql).toContain("outcome = 'success'");
  });

  it('returns zero totals when there are no logs today', async () => {
    dataSource.query.mockResolvedValue([
      {
        provider: null,
        cost_usd: '0',
        attempts: '0',
        successful_attempts: '0',
        failed_attempts: '0',
        average_latency_ms: null,
        is_total: 1,
        date_utc: '2026-10-27',
      },
    ]);

    await expect(service.getTodaySummary()).resolves.toEqual({
      dateUtc: '2026-10-27',
      totalCostUsd: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      providers: [],
    });
  });

  it('surfaces an unexpected aggregate result instead of returning a false summary', async () => {
    await expect(service.getTodaySummary()).rejects.toThrow(
      'Gateway summary query did not return its total row',
    );
  });
});
