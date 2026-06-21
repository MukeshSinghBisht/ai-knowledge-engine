import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum DocumentType {
  Policy = 'policy',
  Faq = 'faq',
  Contract = 'contract',
  Guide = 'guide',
  Other = 'other',
}

export class DocumentMetadataDto {
  @ApiProperty({ example: 'Shop Return Policy' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'en', description: 'ISO 639-1 language code' })
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  language: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.Policy })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ example: ['returns', 'refund', 'electronics'] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({
    example: true,
    description: 'Whether the document should be indexed in the knowledge base',
  })
  @IsBoolean()
  indexable: boolean;

  @ApiProperty({ example: 0.91, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;
}
