import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LlmService } from '../llm/llm.service';
import { parseJsonContent } from '../llm/utils/parse-json-content';
import { normalizeDocumentMetadata } from '../llm/utils/normalize-document-metadata';
import { DOCUMENT_METADATA_SYSTEM_PROMPT } from '../llm/schemas/document-metadata.schema';
import { ChatRequestDto } from './dto/chat-request.dto';
import { DocumentMetadataDto } from './dto/document-metadata.dto';
import { StructuredChatRequestDto } from './dto/structured-chat-request.dto';
import { StructuredChatResponseDto } from './dto/structured-chat-response.dto';

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

  sendToolMessage(dto: ChatRequestDto) {
    return this.llmService.chatWithTools([
      {
        role: 'system',
        content:
          'You are a helpful assistant with access to tools. ' +
          'When the user asks for the current date/time or an exact word count, ' +
          'call the matching tool instead of guessing. ' +
          'After a tool returns, reply to the user in one short, natural sentence.',
      },
      { role: 'user', content: dto.message },
    ]);
  }

  async extractDocumentMetadata(
    dto: StructuredChatRequestDto,
  ): Promise<StructuredChatResponseDto> {
    const maxAttempts = 2;
    let lastValidationError = 'unknown validation error';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.llmService.chatStructured([
        {
          role: 'system',
          content: DOCUMENT_METADATA_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: dto.text,
        },
      ]);

      try {
        const metadata = await this.parseMetadata(result.content, dto.text);

        return {
          metadata,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
        };
      } catch (error) {
        if (
          error instanceof BadGatewayException &&
          attempt < maxAttempts
        ) {
          lastValidationError = error.message;
          continue;
        }

        throw error;
      }
    }

    throw new BadGatewayException(
      `LLM returned metadata that failed validation after ${maxAttempts} attempts: ${lastValidationError}`,
    );
  }

  private async parseMetadata(
    raw: string,
    fallbackText?: string,
  ): Promise<DocumentMetadataDto> {
    let parsed: unknown;

    try {
      parsed = parseJsonContent(raw);
    } catch {
      throw new BadGatewayException(
        'LLM returned invalid JSON for document metadata',
      );
    }

    const normalized = normalizeDocumentMetadata(parsed, fallbackText);
    const metadata = plainToInstance(DocumentMetadataDto, normalized, {
      enableImplicitConversion: true,
    });
    const errors = await validate(metadata);

    if (errors.length > 0) {
      const details = errors
        .map((error) =>
          Object.values(error.constraints ?? {}).join(', '),
        )
        .join('; ');

      throw new BadGatewayException(
        `LLM returned metadata that failed validation: ${details}`,
      );
    }

    return metadata;
  }
}
