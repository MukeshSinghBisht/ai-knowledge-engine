import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QueryDto } from './dto/query.dto';
import { QueryResponseDto } from './dto/query-response.dto';
import { QueryService } from './query.service';

@ApiTags('query')
@Controller()
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post('query')
  @ApiOperation({
    summary: 'Ask a question (RAG: retrieve + generate)',
    description:
      'Embeds the question, retrieves the top-k most similar chunks, and asks the LLM to answer using ONLY those chunks. Returns the answer plus the source chunks it was grounded on. If nothing relevant is found, replies that it does not know.',
  })
  @ApiResponse({
    status: 201,
    description: 'Grounded answer with the source chunks used',
    type: QueryResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'LLM or embedding provider unavailable (is Ollama running?)',
  })
  ask(@Body() dto: QueryDto) {
    return this.queryService.answer(dto);
  }
}
