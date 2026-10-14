import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import { DemoAnalyticsService } from '../demo-analytics/demo-analytics.service';
import { RetrievalMode } from '../gateway/retrieval-mode';
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

const MAX_DOCUMENTS_PER_SESSION = 3;
const MAX_ACTIVE_VISITOR_DOCUMENTS = 100;
const MAX_DOCUMENT_TEXT_LENGTH = 50_000;
const UPLOAD_RETENTION_DAYS = 7;

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
    private readonly demoAnalytics: DemoAnalyticsService,
  ) {}

  /** Store raw text pasted into the JSON body. */
  async store(
    dto: CreateDocumentDto,
    sessionId: string,
  ): Promise<DocumentStoredResponseDto> {
    await this.demoAnalytics.recordActivity(sessionId, 'upload');
    const title = dto.title?.trim() || deriveTitle(dto.text);
    return this.ingest(dto.text, title, 'text', sessionId);
  }

  /** Store an uploaded file (.txt or .pdf) after extracting its text. */
  async storeFile(
    file: Express.Multer.File,
    sessionId: string,
    title?: string,
  ): Promise<DocumentStoredResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a multipart form with field name "file".',
      );
    }

    await this.demoAnalytics.recordActivity(sessionId, 'upload');

    const { text, sourceType } = await extractText(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const resolvedTitle =
      title?.trim() || file.originalname?.trim() || deriveTitle(text);

    return this.ingest(text, resolvedTitle, sourceType, sessionId);
  }

  /**
   * Shared ingestion: chunk → embed → persist, with content-hash dedup.
   * Used by both the text and file endpoints so behavior stays identical.
   */
  private async ingest(
    text: string,
    title: string,
    sourceType: string,
    sessionId: string,
  ): Promise<DocumentStoredResponseDto> {
    if (text.length > MAX_DOCUMENT_TEXT_LENGTH) {
      throw new BadRequestException(
        `Extracted document text exceeds the ${MAX_DOCUMENT_TEXT_LENGTH.toLocaleString()} character limit`,
      );
    }

    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new BadRequestException('Document text has no content to store');
    }

    await this.expireUploads();
    const contentHash = hashContent(text);

    // Deduplicate only within this visitor's private collection.
    const existing = await this.documentRepository.findOne({
      where: { contentHash, ownerId: sessionId },
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

    const sessionDocumentCount = await this.documentRepository.count({
      where: { ownerId: sessionId },
    });
    if (sessionDocumentCount >= MAX_DOCUMENTS_PER_SESSION) {
      throw new HttpException(
        `This demo allows up to ${MAX_DOCUMENTS_PER_SESSION} documents per visitor. Your uploads expire after ${UPLOAD_RETENTION_DAYS} days.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const activeVisitorDocumentCount = await this.documentRepository.count({
      where: { ownerId: Not(IsNull()) },
    });
    if (activeVisitorDocumentCount >= MAX_ACTIVE_VISITOR_DOCUMENTS) {
      throw new HttpException(
        'The demo has reached its temporary upload capacity. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Embed everything FIRST, before any DB write. If the embedding provider
    // fails, nothing is persisted — no orphan document row is left behind.
    const ingestRequestId = randomUUID();
    const embeddings = await Promise.all(
      chunks.map((chunk) =>
        this.llmService.embed(
          chunk,
          { requestId: ingestRequestId },
          'RETRIEVAL_DOCUMENT',
        ),
      ),
    );

    // Persist the document and all its chunks atomically.
    try {
      const documentId = await this.dataSource.transaction(async (manager) => {
        const document = await manager.save(
          manager.create(DocumentEntity, {
            title,
            content: text,
            sourceType,
            contentHash,
            ownerId: sessionId,
          }),
        );

        for (let index = 0; index < chunks.length; index++) {
          await manager.query(
            `INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
             VALUES ($1, $2, $3, $4::vector)`,
            [
              document.id,
              index,
              chunks[index],
              toVectorLiteral(embeddings[index]),
            ],
          );
        }

        return document.id;
      });

      return {
        id: documentId,
        title,
        sourceType,
        chunkCount: chunks.length,
        duplicate: false,
      };
    } catch (error) {
      // Lost a race to another identical upload; the unique index rejected us.
      if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
        const raced = await this.documentRepository.findOne({
          where: { contentHash, ownerId: sessionId },
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
  }

  /** Delete only this visitor's uploads; shared sample documents are preserved. */
  async clearForSession(
    sessionId: string,
  ): Promise<{ deletedDocuments: number; deletedChunks: number }> {
    await this.expireUploads();
    const docRows = await this.dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM documents WHERE owner_id = $1',
      [sessionId],
    );
    const chunkRows = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE d.owner_id = $1`,
      [sessionId],
    );

    await this.dataSource.query('DELETE FROM documents WHERE owner_id = $1', [
      sessionId,
    ]);

    return {
      deletedDocuments: docRows[0]?.count ?? 0,
      deletedChunks: chunkRows[0]?.count ?? 0,
    };
  }

  async search(
    dto: SearchDto,
    options: {
      sessionId: string;
      requestId?: string;
      retrievalMode?: RetrievalMode;
      topK?: number;
    },
  ): Promise<SearchResponseDto> {
    await this.expireUploads();
    const topK = dto.topK ?? 5;
    const embedding = await this.llmService.embed(
      dto.query,
      {
        requestId: options.requestId,
        retrievalMode: options.retrievalMode,
        topK: options.topK ?? topK,
      },
      'RETRIEVAL_QUERY',
    );
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
       WHERE d.owner_id IS NULL OR d.owner_id = $3
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      [queryVector, topK, options.sessionId],
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

  private async expireUploads(): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM documents
       WHERE owner_id IS NOT NULL
         AND created_at < NOW() - INTERVAL '${UPLOAD_RETENTION_DAYS} days'`,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('driverError' in error)
    ) {
      return false;
    }

    const driverError = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === '23505'
    );
  }
}
