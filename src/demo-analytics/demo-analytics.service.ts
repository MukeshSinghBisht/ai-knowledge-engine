import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type DemoActivity = 'query' | 'upload';

const CREATE_DEMO_ACTIVITY_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS demo_activity_sessions (
  session_id         text PRIMARY KEY,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  query_submissions  int NOT NULL DEFAULT 0,
  upload_submissions int NOT NULL DEFAULT 0
);
`;

@Injectable()
export class DemoAnalyticsService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.dataSource.query(CREATE_DEMO_ACTIVITY_TABLE_SQL);
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_demo_activity_sessions_last_seen_at
       ON demo_activity_sessions (last_seen_at)`,
    );
  }

  async recordActivity(
    sessionId: string,
    activity: DemoActivity,
  ): Promise<void> {
    const querySubmissions = activity === 'query' ? 1 : 0;
    const uploadSubmissions = activity === 'upload' ? 1 : 0;

    await this.dataSource.query(
      `INSERT INTO demo_activity_sessions (
         session_id, query_submissions, upload_submissions
       )
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id) DO UPDATE
       SET last_seen_at = now(),
           query_submissions =
             demo_activity_sessions.query_submissions + EXCLUDED.query_submissions,
           upload_submissions =
             demo_activity_sessions.upload_submissions + EXCLUDED.upload_submissions`,
      [sessionId, querySubmissions, uploadSubmissions],
    );
  }
}
