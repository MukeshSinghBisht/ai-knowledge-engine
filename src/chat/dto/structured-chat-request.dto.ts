import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StructuredChatRequestDto {
  @ApiProperty({
    example:
      'Return Policy\n\nItems may be returned within 30 days of purchase with receipt. Electronics must be unopened.',
    description: 'Raw document text to extract metadata from',
    maxLength: 16000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(16000)
  text: string;
}
