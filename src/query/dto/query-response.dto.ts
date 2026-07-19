import { ApiProperty } from '@nestjs/swagger';
import { TokenUsageDto } from '../../chat/dto/chat-response.dto';
import { SearchResultDto } from '../../documents/dto/document-response.dto';

export class QueryResponseDto {
  @ApiProperty({
    example: 'Items may be returned within 30 days of purchase with a valid receipt.',
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
}
