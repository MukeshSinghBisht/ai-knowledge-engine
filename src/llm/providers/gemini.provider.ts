import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  ChatMessage,
  ChatResult,
  LlmProvider,
  StructuredChatResult,
  ToolChatResult,
} from '../llm.types';
import { DOCUMENT_METADATA_SYSTEM_PROMPT } from '../schemas/document-metadata.schema';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;

  private client: GoogleGenerativeAI | null = null;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel =
      this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-2.0-flash';
    // text-embedding-004 outputs 768 dims, matching the vector(768) column.
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'text-embedding-004';
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

  async chatWithTools(): Promise<ToolChatResult> {
    throw new ServiceUnavailableException(
      'Tool calling is not implemented for the Gemini provider yet. Set LLM_PROVIDER=ollama to use POST /chat/tools.',
    );
  }

  async embed(text: string): Promise<number[]> {
    try {
      const model = this.getClient().getGenerativeModel({
        model: this.embeddingModel,
      });

      const result = await model.embedContent(text);
      const vector = result.embedding?.values;

      if (!vector || vector.length === 0) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty embedding',
        );
      }

      return vector;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown Gemini error';

      throw new ServiceUnavailableException(
        `Gemini embedding error: ${message}`,
      );
    }
  }

  async chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult> {
    try {
      const systemInstruction =
        messages
          .filter((message) => message.role === 'system')
          .map((message) => message.content)
          .join('\n') || DOCUMENT_METADATA_SYSTEM_PROMPT;

      const userMessage = [...messages]
        .reverse()
        .find((message) => message.role === 'user')?.content;

      if (!userMessage) {
        throw new ServiceUnavailableException('A user message is required');
      }

      const model = this.getClient().getGenerativeModel({
        model: this.chatModel,
        systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              language: { type: SchemaType.STRING },
              documentType: {
                type: SchemaType.STRING,
                format: 'enum',
                enum: ['policy', 'faq', 'contract', 'guide', 'other'],
              },
              tags: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              indexable: { type: SchemaType.BOOLEAN },
              confidence: { type: SchemaType.NUMBER },
            },
            required: [
              'title',
              'language',
              'documentType',
              'tags',
              'indexable',
              'confidence',
            ],
          },
        },
      });

      const result = await model.generateContent(userMessage);
      const content = result.response.text();

      if (!content) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty structured response',
        );
      }

      const usage = result.response.usageMetadata;

      return {
        content,
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
