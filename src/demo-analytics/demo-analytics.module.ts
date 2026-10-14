import { Global, Module } from '@nestjs/common';
import { DemoAnalyticsService } from './demo-analytics.service';

@Global()
@Module({
  providers: [DemoAnalyticsService],
  exports: [DemoAnalyticsService],
})
export class DemoAnalyticsModule {}
