import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiPropertyOptional({
    example: 'Return Policy',
    description: 'Optional title; derived from the first line if omitted',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({
    example:
      'Return Policy\n\nItems may be returned within 30 days of purchase with a valid receipt. Refunds are issued to the original payment method.',
    description: 'Raw document text to chunk, embed, and store',
    maxLength: 50000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text: string;
}
