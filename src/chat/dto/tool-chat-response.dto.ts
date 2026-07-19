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
}
