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
import { DOCUMENT_METADATA_JSON_SCHEMA } from '../schemas/document-metadata.schema';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

@Injectable()
export class GroqProvider implements LlmProvider {
  readonly name = 'groq' as const;

  private client: OpenAI | null = null;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel = this.configService.get<string>('GROQ_CHAT_MODEL') ?? '';
  }

  private getClient(): OpenAI {
    if (!this.chatModel) {
      throw new ServiceUnavailableException(
        'GROQ_CHAT_MODEL is not set. Choose an active model from https://console.groq.com/docs/models',
      );
    }

    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GROQ_API_KEY is not set. Create a key at https://console.groq.com/keys',
      );
    }

    this.client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
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
          'Groq returned an empty response',
        );
      }

      return {
        reply,
        model: response.model || this.chatModel,
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
        throw new ServiceUnavailableException(`Groq error: ${error.message}`);
      }
      throw error;
    }
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
          'Groq returned an empty structured response',
        );
      }

      return {
        content,
        model: response.model || this.chatModel,
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
        throw new ServiceUnavailableException(`Groq error: ${error.message}`);
      }
      throw error;
    }
  }

  chatWithTools(): Promise<ToolChatResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Tool calling is not implemented for the Groq provider yet.',
      ),
    );
  }

  embed(): Promise<number[]> {
    throw new ServiceUnavailableException(
      'Embeddings are not implemented for Groq. Set LLM_EMBEDDING_PROVIDER=gemini to use Gemini embeddings.',
    );
  }
}
