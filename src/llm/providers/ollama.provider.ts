import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage, ChatResult, LlmProvider, StructuredChatResult } from '../llm.types';
import {
  DOCUMENT_METADATA_JSON_SCHEMA,
  DOCUMENT_METADATA_SYSTEM_PROMPT,
} from '../schemas/document-metadata.schema';

@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama' as const;

  private client: OpenAI | null = null;
  private readonly chatModel: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel =
      this.configService.get<string>('OLLAMA_CHAT_MODEL') ?? 'llama3.2';
    this.baseUrl =
      this.configService.get<string>('OLLAMA_BASE_URL') ??
      'http://localhost:11434/v1';
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey =
      this.configService.get<string>('OLLAMA_API_KEY') ?? 'ollama';

    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
    });

    return this.client;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.chatModel,
        messages,
      });

      const reply = response.choices[0]?.message?.content;

      if (!reply) {
        throw new ServiceUnavailableException(
          'Ollama returned an empty response',
        );
      }

      return {
        reply,
        model: response.model ?? this.chatModel,
        provider: this.name,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        const hint =
          error.status === undefined || error.status >= 500
            ? ' Is Ollama running? Try: ollama serve'
            : '';

        throw new ServiceUnavailableException(
          `Ollama error: ${error.message}.${hint}`,
        );
      }

      const message =
        error instanceof Error ? error.message : 'Unknown Ollama error';

      throw new ServiceUnavailableException(
        `Ollama error: ${message}. Is Ollama running at ${this.baseUrl}?`,
      );
    }
  }

  async chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult> {
    const structuredMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `${DOCUMENT_METADATA_SYSTEM_PROMPT}\n\nRespond with JSON matching this schema:\n${JSON.stringify(DOCUMENT_METADATA_JSON_SCHEMA)}`,
      },
      ...messages.filter((message) => message.role !== 'system'),
    ];

    try {
      const response = await this.getClient().chat.completions.create({
        model: this.chatModel,
        messages: structuredMessages,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new ServiceUnavailableException(
          'Ollama returned an empty structured response',
        );
      }

      return {
        content,
        model: response.model ?? this.chatModel,
        provider: this.name,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        const hint =
          error.status === undefined || error.status >= 500
            ? ' Is Ollama running? Try: ollama serve'
            : '';

        throw new ServiceUnavailableException(
          `Ollama error: ${error.message}.${hint}`,
        );
      }

      const message =
        error instanceof Error ? error.message : 'Unknown Ollama error';

      throw new ServiceUnavailableException(
        `Ollama error: ${message}. Is Ollama running at ${this.baseUrl}?`,
      );
    }
  }
}
