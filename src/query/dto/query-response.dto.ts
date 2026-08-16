import { ApiProperty } from '@nestjs/swagger';
import {
  ProviderAttemptDto,
  TokenUsageDto,
} from '../../chat/dto/chat-response.dto';
import { SearchResultDto } from '../../documents/dto/document-response.dto';
import { RetrievalMode } from '../../gateway/retrieval-mode';

export class QueryResponseDto {
  @ApiProperty({
    example:
      'Items may be returned within 30 days of purchase with a valid receipt.',
    description: 'Answer generated from the retrieved sources only',
  })
  answer: string;

  @ApiProperty({
    example: false,
    description:
      'True when the answer is backed by retrieved chunks. False means nothing relevant was found.',
  })
  grounded: boolean;

  @ApiProperty({
    type: [SearchResultDto],
    description: 'The chunks used as context, so the answer is traceable',
  })
  sources: SearchResultDto[];

  @ApiProperty({ example: 'llama3.2' })
  model: string;

  @ApiProperty({ example: 'ollama', enum: ['ollama', 'gemini', 'openai'] })
  provider: string;

  @ApiProperty({ type: TokenUsageDto })
  usage: TokenUsageDto;

  @ApiProperty({
    example: '3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44',
    description: 'Trace id for this query (embed + generate share the same id)',
  })
  requestId: string;

  @ApiProperty({
    example: 0.00001202,
    description: 'Estimated USD from token usage × provider *_USD_PER_1M rates.',
  })
  costUsd: number;

  @ApiProperty({
    example: 842,
    description:
      'Successful generate attempt wall-clock time in milliseconds (0 if no LLM call)',
  })
  latencyMs: number;

  @ApiProperty({
    example: 'simple',
    enum: RetrievalMode,
    required: false,
    nullable: true,
    description: 'Research depth used for this query (null when not set)',
  })
  mode: RetrievalMode | null;

  @ApiProperty({
    example: 2,
    description: 'Chunks retrieved as context for this query',
  })
  topK: number;

  @ApiProperty({
    type: [ProviderAttemptDto],
    description: 'Gateway provider attempts for the generate step',
  })
  attempts: ProviderAttemptDto[];
}
