import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
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
import type { DemoSessionRequest } from '../demo-session.middleware';
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
      'Splits the text into overlapping chunks, generates embeddings, and stores them privately for this visitor session. Each visitor can store up to 3 documents; uploads expire after 7 days.',
  })
  @ApiResponse({
    status: 201,
    description: 'Document stored with chunk count',
    type: DocumentStoredResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'Embedding provider unavailable (is Ollama running?)',
  })
  store(@Body() dto: CreateDocumentDto, @Req() request: DemoSessionRequest) {
    return this.documentsService.store(dto, request.demoSessionId);
  }

  @Post('documents/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Upload a .txt or .pdf file (extract + chunk + embed + persist)',
    description:
      'Extracts text from the uploaded file, then ingests it privately for this visitor session. Max 10 MB per file and 3 documents per visitor; uploads expire after 7 days.',
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
          description: '.txt or .pdf file, maximum size 10 MB',
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
    @Req() request: DemoSessionRequest,
    @Body('title') title?: string,
  ) {
    return this.documentsService.storeFile(file, request.demoSessionId, title);
  }

  @Delete('documents')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Delete this visitor session’s uploads',
    description:
      'Deletes only documents uploaded from this browser session. Shared sample documents and other visitors’ uploads are not affected.',
  })
  @ApiResponse({
    status: 200,
    description: 'Counts of what was deleted',
    type: WipeResponseDto,
  })
  clearAll(@Req() request: DemoSessionRequest) {
    return this.documentsService.clearForSession(request.demoSessionId);
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
  search(@Body() dto: SearchDto, @Req() request: DemoSessionRequest) {
    return this.documentsService.search(dto, {
      sessionId: request.demoSessionId,
    });
  }
}
