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

const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.2-3b-instruct';

@Injectable()
export class CloudflareProvider implements LlmProvider {
  readonly name = 'cloudflare' as const;

  private client: OpenAI | null = null;
  private readonly accountId: string;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    this.accountId =
      this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID') ?? '';
    this.chatModel =
      this.configService.get<string>('CLOUDFLARE_CHAT_MODEL') ??
      DEFAULT_CHAT_MODEL;
  }

  private getClient(): OpenAI {
    if (this.client) {
      return this.client;
    }

    if (!this.accountId) {
      throw new ServiceUnavailableException(
        'CLOUDFLARE_ACCOUNT_ID is not set. Find it in your Cloudflare dashboard.',
      );
    }

    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');
    if (!apiToken) {
      throw new ServiceUnavailableException(
        'CLOUDFLARE_API_TOKEN is not set. Create a token with Workers AI permission.',
      );
    }

    this.client = new OpenAI({
      apiKey: apiToken,
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/v1`,
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
          'Cloudflare Workers AI returned an empty response',
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
        throw new ServiceUnavailableException(
          `Cloudflare Workers AI error: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.chatModel,
        messages,
        response_format: { type: 'json_object' },
      });
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new ServiceUnavailableException(
          'Cloudflare Workers AI returned an empty structured response',
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
        throw new ServiceUnavailableException(
          `Cloudflare Workers AI error: ${error.message}`,
        );
      }
      throw error;
    }
  }

  chatWithTools(): Promise<ToolChatResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Tool calling is not implemented for the Cloudflare Workers AI provider.',
      ),
    );
  }

  embed(): Promise<number[]> {
    throw new ServiceUnavailableException(
      'Embeddings are not implemented for Cloudflare Workers AI. Set LLM_EMBEDDING_PROVIDER=gemini to use Gemini embeddings.',
    );
  }
}
