import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ChatMessage,
  ChatResult,
  LlmProvider,
  StructuredChatResult,
  ToolChatResult,
} from '../llm.types';
import {
  DOCUMENT_METADATA_JSON_SCHEMA,
} from '../schemas/document-metadata.schema';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai' as const;

  private client: OpenAI | null = null;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel =
      this.configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini';
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not set. Copy .env.example to .env',
      );
    }

    this.client = new OpenAI({ apiKey });
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
          'OpenAI returned an empty response',
        );
      }

      return {
        reply,
        model: response.model,
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
        throw new ServiceUnavailableException(
          `OpenAI error: ${error.message}`,
        );
      }

      throw error;
    }
  }

  async chatWithTools(): Promise<ToolChatResult> {
    throw new ServiceUnavailableException(
      'Tool calling is not implemented for the OpenAI provider yet. Set LLM_PROVIDER=ollama to use POST /chat/tools.',
    );
  }

  async embed(): Promise<number[]> {
    throw new ServiceUnavailableException(
      'Embeddings are not implemented for the OpenAI provider yet. Set LLM_PROVIDER=ollama (nomic-embed-text, 768 dims).',
    );
  }

  async chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.chatModel,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'document_metadata',
            strict: true,
            schema: DOCUMENT_METADATA_JSON_SCHEMA,
          },
        },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new ServiceUnavailableException(
          'OpenAI returned an empty structured response',
        );
      }

      return {
        content,
        model: response.model,
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
        throw new ServiceUnavailableException(
          `OpenAI error: ${error.message}`,
        );
      }

      throw error;
    }
  }
}
