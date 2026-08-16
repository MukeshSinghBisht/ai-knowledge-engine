import { ApiProperty } from '@nestjs/swagger';

export class TokenUsageDto {
  @ApiProperty({ example: 25 })
  promptTokens: number;

  @ApiProperty({ example: 40 })
  completionTokens: number;

  @ApiProperty({ example: 65 })
  totalTokens: number;
}

export class ProviderAttemptDto {
  @ApiProperty({ example: 1 })
  attempt: number;

  @ApiProperty({ example: 'openai', enum: ['ollama', 'gemini', 'openai'] })
  provider: string;

  @ApiProperty({
    example: 'timeout',
    enum: ['success', 'timeout', 'error'],
  })
  outcome: 'success' | 'timeout' | 'error';

  @ApiProperty({ example: 10012 })
  latencyMs: number;

  @ApiProperty({
    example: 'Timed out after 10000ms',
    required: false,
  })
  failureReason?: string;
}

export class ChatResponseDto {
  @ApiProperty({
    example:
      'RAG stands for Retrieval-Augmented Generation: find relevant documents, then generate an answer using that context.',
  })
  reply: string;

  @ApiProperty({ example: 'llama3.2' })
  model: string;

  @ApiProperty({ example: 'ollama', enum: ['ollama', 'gemini', 'openai'] })
  provider: string;

  @ApiProperty({ type: TokenUsageDto })
  usage: TokenUsageDto;

  @ApiProperty({
    example: '3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44',
    description: 'Trace id for this call (matches llm_gateway_logs.request_id)',
  })
  requestId: string;

  @ApiProperty({
    example: 0.0000037,
    description: 'Estimated USD from token usage × provider *_USD_PER_1M rates.',
  })
  costUsd: number;

  @ApiProperty({
    example: 842,
    description: 'Successful provider attempt wall-clock time in milliseconds',
  })
  latencyMs: number;

  @ApiProperty({
    type: [ProviderAttemptDto],
    description: 'Gateway provider attempts (primary + any fallbacks)',
  })
  attempts: ProviderAttemptDto[];
}
