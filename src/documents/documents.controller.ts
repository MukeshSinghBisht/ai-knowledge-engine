import { Body, Controller, Post } from '@nestjs/common';
import {
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
} from './dto/document-response.dto';
import { SearchDto } from './dto/search.dto';

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('documents')
  @ApiOperation({
    summary: 'Store a document (chunk + embed + persist)',
    description:
      'Splits the text into overlapping chunks, generates an embedding per chunk (Ollama nomic-embed-text), and stores them in pgvector for semantic search.',
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
