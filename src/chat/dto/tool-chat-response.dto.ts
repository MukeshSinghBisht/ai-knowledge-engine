import { ApiProperty } from '@nestjs/swagger';
import { TokenUsageDto } from './chat-response.dto';

export class ToolChatResponseDto {
  @ApiProperty({ example: 'Today is July 19, 2026.' })
  reply: string;

  @ApiProperty({
    example: ['getCurrentDate'],
    type: [String],
    description: 'Names of the tools the model actually called',
  })
  toolsUsed: string[];

  @ApiProperty({ example: 'llama3.2' })
  model: string;

  @ApiProperty({ example: 'ollama', enum: ['ollama', 'gemini', 'openai'] })
  provider: string;

  @ApiProperty({ type: TokenUsageDto })
  usage: TokenUsageDto;

  @ApiProperty({ example: '3f1c0a8e-2b7d-4c11-9a55-8d2e1f0b7c44' })
  requestId: string;

  @ApiProperty({
    example: 0.0000037,
    description: 'Estimated USD from token usage × provider *_USD_PER_1M rates.',
  })
  costUsd: number;

  @ApiProperty({ example: 650 })
  latencyMs: number;
}
