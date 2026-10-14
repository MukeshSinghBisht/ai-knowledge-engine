import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  ChatMessage,
  ChatResult,
  EmbeddingTaskType,
  LlmProvider,
  StructuredChatResult,
  ToolChatResult,
} from '../llm.types';
import {
  DOCUMENT_METADATA_JSON_SCHEMA,
  DOCUMENT_METADATA_SYSTEM_PROMPT,
} from '../schemas/document-metadata.schema';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;

  private client: GoogleGenAI | null = null;
  private readonly chatModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.chatModel =
      this.configService.get<string>('GEMINI_CHAT_MODEL') ?? 'gemini-3.8-flash';
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
      'gemini-embedding-2';
  }

  private getClient(): GoogleGenAI {
    if (this.client) {
      return this.client;
    }

    this.client = new GoogleGenAI({ apiKey: this.getApiKey() });
    return this.client;
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not set. See docs/gemini-setup.md',
      );
    }
    return apiKey;
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

      const input = messages
        .filter((message) => message.role !== 'system')
        .map(
          (message) =>
            `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`,
        )
        .join('\n\n');

      const result = await this.getClient().interactions.create({
        model: this.chatModel,
        input,
        system_instruction: systemInstruction || undefined,
        store: false,
      });
      const reply = result.output_text;

      if (!reply) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty response',
        );
      }

      const usage = result.usage;

      return {
        reply,
        model: this.chatModel,
        provider: this.name,
        usage: {
          promptTokens: usage?.total_input_tokens ?? 0,
          completionTokens: usage?.total_output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
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

  chatWithTools(): Promise<ToolChatResult> {
    return Promise.reject(
      new ServiceUnavailableException(
        'Tool calling is not implemented for the Gemini provider yet. Set LLM_PROVIDER=ollama to use POST /chat/tools.',
      ),
    );
  }

  async embed(
    text: string,
    taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[]> {
    try {
      const content =
        taskType === 'RETRIEVAL_QUERY'
          ? `task: question answering | query: ${text}`
          : `title: none | text: ${text}`;
      const result = await this.getClient().models.embedContent({
        model: this.embeddingModel,
        contents: content,
        config: { outputDimensionality: 768 },
      });
      const vector = result.embeddings?.[0]?.values;

      if (!vector || vector.some((value) => !Number.isFinite(value))) {
        throw new ServiceUnavailableException(
          'Gemini returned an invalid embedding response',
        );
      }

      if (vector.length !== 768) {
        throw new ServiceUnavailableException(
          `Gemini returned an invalid embedding dimension; expected 768, got ${vector.length}`,
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

      const result = await this.getClient().interactions.create({
        model: this.chatModel,
        input: userMessage,
        system_instruction: systemInstruction,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: DOCUMENT_METADATA_JSON_SCHEMA,
        },
        store: false,
      });
      const content = result.output_text;

      if (!content) {
        throw new ServiceUnavailableException(
          'Gemini returned an empty structured response',
        );
      }

      const usage = result.usage;

      return {
        content,
        model: this.chatModel,
        provider: this.name,
        usage: {
          promptTokens: usage?.total_input_tokens ?? 0,
          completionTokens: usage?.total_output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
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
