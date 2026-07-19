import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
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
import { extractText, hashContent } from './utils/extract-text';

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

  /** Store raw text pasted into the JSON body. */
  async store(dto: CreateDocumentDto): Promise<DocumentStoredResponseDto> {
    const title = dto.title?.trim() || deriveTitle(dto.text);
    return this.ingest(dto.text, title, 'text');
  }

  /** Store an uploaded file (.txt or .pdf) after extracting its text. */
  async storeFile(
    file: Express.Multer.File,
    title?: string,
  ): Promise<DocumentStoredResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a multipart form with field name "file".',
      );
    }

    const { text, sourceType } = await extractText(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const resolvedTitle =
      title?.trim() || file.originalname?.trim() || deriveTitle(text);

    return this.ingest(text, resolvedTitle, sourceType);
  }

  /**
   * Shared ingestion: chunk → embed → persist, with content-hash dedup.
   * Used by both the text and file endpoints so behavior stays identical.
   */
  private async ingest(
    text: string,
    title: string,
    sourceType: string,
  ): Promise<DocumentStoredResponseDto> {
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new BadRequestException('Document text has no content to store');
    }

    const contentHash = hashContent(text);

    // Idempotency: identical content already stored → return it, embed nothing.
    const existing = await this.documentRepository.findOne({
      where: { contentHash },
    });

    if (existing) {
      return {
        id: existing.id,
        title: existing.title,
        sourceType: existing.sourceType,
        chunkCount: chunks.length,
        duplicate: true,
      };
    }

    let document: DocumentEntity;
    try {
      document = await this.documentRepository.save(
        this.documentRepository.create({
          title,
          content: text,
          sourceType,
          contentHash,
        }),
      );
    } catch (error) {
      // Lost a race to another identical upload; the unique index rejected us.
      if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
        const raced = await this.documentRepository.findOne({
          where: { contentHash },
        });
        if (raced) {
          return {
            id: raced.id,
            title: raced.title,
            sourceType: raced.sourceType,
            chunkCount: chunks.length,
            duplicate: true,
          };
        }
      }
      throw error;
    }

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

    return {
      id: document.id,
      title,
      sourceType,
      chunkCount: chunks.length,
      duplicate: false,
    };
  }

  /** Delete every document and chunk. Intended for demo resets. */
  async clearAll(): Promise<{ deletedDocuments: number; deletedChunks: number }> {
    const docRows = await this.dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM documents',
    );
    const chunkRows = await this.dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM document_chunks',
    );

    // CASCADE clears chunks too, but naming both is explicit and order-safe.
    await this.dataSource.query('TRUNCATE TABLE document_chunks, documents');

    return {
      deletedDocuments: docRows[0]?.count ?? 0,
      deletedChunks: chunkRows[0]?.count ?? 0,
    };
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

  private isUniqueViolation(error: QueryFailedError): boolean {
    const code = (error as unknown as { code?: string }).code;
    return code === '23505';
  }
}
