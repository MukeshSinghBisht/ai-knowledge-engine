import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

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
}
