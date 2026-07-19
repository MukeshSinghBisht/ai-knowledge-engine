import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

// LlmModule is @Global, so LlmService is available without importing it here.
@Module({
  imports: [DocumentsModule],
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
