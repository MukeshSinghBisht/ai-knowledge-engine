import { HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DemoAnalyticsService } from '../demo-analytics/demo-analytics.service';
import { DocumentsService } from '../documents/documents.service';
import { LlmService } from '../llm/llm.service';
import { QueryService } from './query.service';

describe('QueryService demo quota', () => {
  let documentsService: jest.Mocked<Pick<DocumentsService, 'search'>>;
  let llmService: jest.Mocked<Pick<LlmService, 'activeProvider' | 'chat'>>;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let demoAnalytics: jest.Mocked<Pick<DemoAnalyticsService, 'recordActivity'>>;
  let service: QueryService;

  beforeEach(() => {
    documentsService = {
      search: jest.fn().mockResolvedValue({ results: [] }),
    };
    llmService = {
      activeProvider: 'cloudflare',
      chat: jest.fn(),
    };
    dataSource = {
      query: jest.fn(),
    };
    demoAnalytics = {
      recordActivity: jest.fn().mockResolvedValue(undefined),
    };
    service = new QueryService(
      documentsService as unknown as DocumentsService,
      llmService as unknown as LlmService,
      dataSource as unknown as DataSource,
      demoAnalytics as unknown as DemoAnalyticsService,
    );
  });

  it('creates quota storage during module initialization', async () => {
    dataSource.query.mockResolvedValue([]);

    await service.onModuleInit();

    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(dataSource.query.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS demo_query_usage',
    );
  });

  it('allows an eligible query and records its usage', async () => {
    dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ query_count: 1 }]);

    const response = await service.answer({ query: 'A question' }, 'session');

    expect(response.grounded).toBe(false);
    expect(demoAnalytics.recordActivity).toHaveBeenCalledWith(
      'session',
      'query',
    );
    expect(documentsService.search).toHaveBeenCalledTimes(1);
    expect(dataSource.query.mock.calls[1][0]).toContain('query_count < $2');
    expect(dataSource.query.mock.calls[1][1]).toEqual(['session', 5]);
  });

  it('rejects a sixth query before running retrieval or model calls', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    try {
      await service.answer({ query: 'One too many' }, 'session');
      throw new Error('Expected demo quota to reject the query');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).toContain('up to 5 questions');
    }

    expect(documentsService.search).not.toHaveBeenCalled();
    expect(llmService.chat).not.toHaveBeenCalled();
  });
});
