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
}
