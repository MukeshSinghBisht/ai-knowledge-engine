import { ApiProperty } from '@nestjs/swagger';

export class TokenUsageDto {
  @ApiProperty({ example: 25 })
  promptTokens: number;

  @ApiProperty({ example: 40 })
  completionTokens: number;

  @ApiProperty({ example: 65 })
  totalTokens: number;
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
}
