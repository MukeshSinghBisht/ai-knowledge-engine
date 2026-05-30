import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage, ChatResult, LlmProvider } from '../llm.types';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;

  private client: GoogleGenerativeAI | null = null;
  private readonly chatModel: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel =
      this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-2.0-flash';
  }

  private getClient(): GoogleGenerativeAI {
    if (this.client) {
      return this.client;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not set. See docs/gemini-setup.md',
      );
    }

    this.client = new GoogleGenerativeAI(apiKey);
    return this.client;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    try {
      const systemInstruction = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n');

      const userMessage = [...messages]
        .reverse()
        .find((message) => message.role === 'user')?.content;

      if (!userMessage) {
        throw new ServiceUnavailableException('A user message is required');
      }

      const model = this.getClient().getGenerativeModel({
        model: this.chatModel,
        systemInstruction: systemInstruction || undefined,
      });

      const result = await model.generateContent(userMessage);
      const reply = result.response.text();

      if (!reply) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty response',
        );
      }

      const usage = result.response.usageMetadata;

      return {
        reply,
        model: this.chatModel,
        provider: this.name,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown Gemini error';

      throw new ServiceUnavailableException(`Gemini error: ${message}`);
    }
  }
}
