import { DataSource } from 'typeorm';
import { DemoAnalyticsService } from './demo-analytics.service';

describe('DemoAnalyticsService', () => {
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let service: DemoAnalyticsService;

  beforeEach(() => {
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };
    service = new DemoAnalyticsService(dataSource as unknown as DataSource);
  });

  it('creates persistent demo activity storage during startup', async () => {
    await service.onModuleInit();

    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(dataSource.query.mock.calls[0][0]).toContain(
      'CREATE TABLE IF NOT EXISTS demo_activity_sessions',
    );
    expect(dataSource.query.mock.calls[1][0]).toContain(
      'idx_demo_activity_sessions_last_seen_at',
    );
  });

  it('increments anonymous session query and upload submissions', async () => {
    await service.recordActivity('session', 'query');
    await service.recordActivity('session', 'upload');

    expect(dataSource.query.mock.calls[0][1]).toEqual(['session', 1, 0]);
    expect(dataSource.query.mock.calls[1][1]).toEqual(['session', 0, 1]);
    expect(dataSource.query.mock.calls[0][0]).toContain(
      'ON CONFLICT (session_id) DO UPDATE',
    );
  });
});
