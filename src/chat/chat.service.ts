import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Injectable()
export class ChatService {
  constructor(private readonly llmService: LlmService) {}

  sendMessage(dto: ChatRequestDto) {
    return this.llmService.chat([
      {
        role: 'system',
        content:
          'You are a helpful assistant. Answer clearly and concisely.',
      },
      { role: 'user', content: dto.message },
    ]);
  }
}
