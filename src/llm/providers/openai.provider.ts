import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatMessage, ChatResult, LlmProvider } from '../llm.types';

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
}
