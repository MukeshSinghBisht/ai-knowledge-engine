import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import {
  DocumentStoredResponseDto,
  SearchResponseDto,
  WipeResponseDto,
} from './dto/document-response.dto';
import { SearchDto } from './dto/search.dto';

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('documents')
  @ApiOperation({
    summary: 'Store a document from raw text (chunk + embed + persist)',
    description:
      'Splits the text into overlapping chunks, generates an embedding per chunk (Ollama nomic-embed-text), and stores them in pgvector for semantic search. Re-sending identical content is a no-op (duplicate: true).',
  })
  @ApiResponse({
    status: 201,
    description: 'Document stored with chunk count',
    type: DocumentStoredResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Embedding provider unavailable (is Ollama running?)',
  })
  store(@Body() dto: CreateDocumentDto) {
    return this.documentsService.store(dto);
  }

  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Upload a .txt or .pdf file (extract + chunk + embed + persist)',
    description:
      'Extracts text from the uploaded file, then ingests it exactly like POST /documents. Max 10 MB. Identical content is not re-ingested (duplicate: true).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '.txt or .pdf file',
        },
        title: {
          type: 'string',
          description: 'Optional title; falls back to the file name',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document stored with chunk count',
    type: DocumentStoredResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Embedding provider unavailable (is Ollama running?)',
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
  ) {
    return this.documentsService.storeFile(file, title);
  }

  @Delete('documents')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete ALL documents and chunks (demo reset)',
    description:
      'Wipes every stored document and its chunks so you can start a demo from a clean slate. Destructive and irreversible — there is no per-document delete here.',
  })
  @ApiResponse({
    status: 200,
    description: 'Counts of what was deleted',
    type: WipeResponseDto,
  })
  clearAll() {
    return this.documentsService.clearAll();
  }

  @Post('search')
  @ApiOperation({
    summary: 'Semantic search over stored chunks',
    description:
      'Embeds the query and returns the top-k most similar chunks by cosine similarity. Retrieval only — no LLM answer.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ranked matching chunks with similarity scores',
    type: SearchResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Embedding provider unavailable (is Ollama running?)',
  })
  search(@Body() dto: SearchDto) {
    return this.documentsService.search(dto);
  }
}
