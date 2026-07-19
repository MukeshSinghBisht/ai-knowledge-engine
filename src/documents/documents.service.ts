import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LlmService } from '../llm/llm.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import {
  DocumentStoredResponseDto,
  SearchResponseDto,
  SearchResultDto,
} from './dto/document-response.dto';
import { SearchDto } from './dto/search.dto';
import { DocumentEntity } from './entities/document.entity';
import { chunkText, deriveTitle, toVectorLiteral } from './utils/chunk-text';

interface SearchRow {
  chunkId: string;
  documentId: string;
  title: string;
  chunkIndex: number;
  content: string;
  score: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
  ) {}

  async store(dto: CreateDocumentDto): Promise<DocumentStoredResponseDto> {
    const chunks = chunkText(dto.text);

    if (chunks.length === 0) {
      throw new BadRequestException('Document text has no content to store');
    }

    const title = dto.title?.trim() || deriveTitle(dto.text);

    const document = await this.documentRepository.save(
      this.documentRepository.create({ title, content: dto.text }),
    );

    let index = 0;
    for (const chunk of chunks) {
      const embedding = await this.llmService.embed(chunk);

      await this.dataSource.query(
        `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [document.id, index, chunk, toVectorLiteral(embedding)],
      );

      index++;
    }

    return { id: document.id, title, chunkCount: chunks.length };
  }

  async search(dto: SearchDto): Promise<SearchResponseDto> {
    const topK = dto.topK ?? 5;
    const embedding = await this.llmService.embed(dto.query);
    const queryVector = toVectorLiteral(embedding);

    const rows = await this.dataSource.query<SearchRow[]>(
      `SELECT c.id            AS "chunkId",
              c.document_id    AS "documentId",
              d.title          AS "title",
              c.chunk_index    AS "chunkIndex",
              c.content        AS "content",
              1 - (c.embedding <=> $1::vector) AS "score"
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [queryVector, topK],
    );

    const results: SearchResultDto[] = rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      title: row.title,
      chunkIndex: row.chunkIndex,
      content: row.content,
      score: Number(row.score),
    }));

    return { query: dto.query, results };
  }
}
