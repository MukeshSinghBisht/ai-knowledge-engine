import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RetrievalMode } from '../../gateway/retrieval-mode';

export class QueryDto {
  @ApiProperty({
    example: 'How long do I have to return an item?',
    description: 'Natural-language question, answered from stored documents only',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  query: string;

  @ApiPropertyOptional({
    enum: RetrievalMode,
    example: RetrievalMode.Simple,
    description:
      'Research depth. simple = 2 chunks (cheaper); thorough = 12 chunks (more context).',
  })
  @IsOptional()
  @IsEnum(RetrievalMode)
  mode?: RetrievalMode;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Number of chunks to retrieve (default: 4, or 2/12 when mode is simple/thorough)',
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;
}
