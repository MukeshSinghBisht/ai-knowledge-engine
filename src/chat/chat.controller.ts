import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { StructuredChatRequestDto } from './dto/structured-chat-request.dto';
import { StructuredChatResponseDto } from './dto/structured-chat-response.dto';
import { ToolChatResponseDto } from './dto/tool-chat-response.dto';
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Send a chat message',
    description:
      'Sends a user message to the configured LLM provider (Gemini by default) and returns the reply with token usage.',
  })
  @ApiResponse({ status: 201, description: 'LLM reply', type: ChatResponseDto })
  @ApiServiceUnavailableResponse({
    description: 'LLM API error or missing API key (GEMINI_API_KEY or OPENAI_API_KEY)',
  })
  chat(@Body() dto: ChatRequestDto) {
    return this.chatService.sendMessage(dto);
  }

  @Post('structured')
  @ApiOperation({
    summary: 'Extract document metadata as structured JSON',
    description:
      'Analyzes raw document text and returns validated metadata fields for knowledge-base ingestion (title, language, type, tags, indexable, confidence).',
  })
  @ApiResponse({
    status: 201,
    description: 'Validated document metadata',
    type: StructuredChatResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'LLM returned invalid or unparseable metadata JSON',
  })
  @ApiServiceUnavailableResponse({
    description: 'LLM API error or provider unavailable',
  })
  extractMetadata(@Body() dto: StructuredChatRequestDto) {
    return this.chatService.extractDocumentMetadata(dto);
  }

  @Post('tools')
  @ApiOperation({
    summary: 'Chat with tool/function calling',
    description:
      'Sends a message to the LLM with tools available (getCurrentDate, countWords). ' +
      'The model may call a tool; the backend runs it and feeds the result back until a final answer is produced. ' +
      'Currently implemented for the Ollama provider.',
  })
  @ApiResponse({
    status: 201,
    description: 'Final reply plus the names of any tools the model called',
    type: ToolChatResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'LLM API error, provider unavailable, or tool calling not supported by the active provider',
  })
  sendToolMessage(@Body() dto: ChatRequestDto) {
    return this.chatService.sendToolMessage(dto);
  }
}