import { ApiProperty } from '@nestjs/swagger';

export class DocumentStoredResponseDto {
  @ApiProperty({ example: 'a3f1c2e4-...' })
  id: string;

  @ApiProperty({ example: 'Return Policy' })
  title: string;

  @ApiProperty({ example: 3, description: 'Number of chunks embedded and stored' })
  chunkCount: number;
}

export class SearchResultDto {
  @ApiProperty({ example: 'b7d2...' })
  chunkId: string;

  @ApiProperty({ example: 'a3f1...' })
  documentId: string;

  @ApiProperty({ example: 'Return Policy' })
  title: string;

  @ApiProperty({ example: 0 })
  chunkIndex: number;

  @ApiProperty({ example: 'Items may be returned within 30 days...' })
  content: string;

  @ApiProperty({
    example: 0.87,
    description: 'Cosine similarity (1 = identical, higher is closer)',
  })
  score: number;
}

export class SearchResponseDto {
  @ApiProperty({ example: 'How long do I have to return an item?' })
  query: string;

  @ApiProperty({ type: [SearchResultDto] })
  results: SearchResultDto[];
}
