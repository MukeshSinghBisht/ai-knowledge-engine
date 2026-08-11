import { ApiProperty } from '@nestjs/swagger';
import { TokenUsageDto } from './chat-response.dto';
import { DocumentMetadataDto } from './document-metadata.dto';

export class StructuredChatResponseDto {
  @ApiProperty({ type: DocumentMetadataDto })
  metadata: DocumentMetadataDto;

  @ApiProperty({ example: 'llama3.2' })
  model: string;

  @ApiProperty({ example: 'ollama', enum: ['ollama', 'gemini', 'openai'] })
  provider: string;

  @ApiProperty({ type: TokenUsageDto })
  usage: TokenUsageDto;

  @ApiProperty({ example: '3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44' })
  requestId: string;

  @ApiProperty({
    example: 0.0000088,
    description: 'Estimated USD from token usage × provider *_USD_PER_1M rates.',
  })
  costUsd: number;

  @ApiProperty({ example: 1200 })
  latencyMs: number;
}
