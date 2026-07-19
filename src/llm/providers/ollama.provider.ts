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
  DOCUMENT_METADATA_SYSTEM_PROMPT,
} from '../schemas/document-metadata.schema';
import { TOOL_DEFINITIONS, runTool } from '../tools/tools';

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

  async chatWithTools(messages: ChatMessage[]): Promise<ToolChatResult> {
    const client = this.getClient();

    // Working history grows every round: we append the model's tool requests
    // and our tool results, then re-send the whole thing (the model is stateless).
    const workingMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const toolsUsed: string[] = [];
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const maxRounds = 5;

    try {
      for (let round = 0; round < maxRounds; round++) {
        const response = await client.chat.completions.create({
          model: this.chatModel,
          messages: workingMessages,
          tools: TOOL_DEFINITIONS as OpenAI.Chat.Completions.ChatCompletionTool[],
        });

        usage.promptTokens += response.usage?.prompt_tokens ?? 0;
        usage.completionTokens += response.usage?.completion_tokens ?? 0;
        usage.totalTokens += response.usage?.total_tokens ?? 0;

        const message = response.choices[0]?.message;

        if (!message) {
          throw new ServiceUnavailableException(
            'Ollama returned an empty response',
          );
        }

        const toolCalls = message.tool_calls ?? [];

        // No tool requested → this is the final answer.
        if (toolCalls.length === 0) {
          const reply = message.content;

          if (!reply) {
            throw new ServiceUnavailableException(
              'Ollama returned an empty response',
            );
          }

          return {
            reply,
            toolsUsed,
            model: response.model ?? this.chatModel,
            provider: this.name,
            usage,
          };
        }

        // Model wants tools: record its request, run each tool, feed results back.
        workingMessages.push(
          message as OpenAI.Chat.Completions.ChatCompletionMessageParam,
        );

        for (const toolCall of toolCalls) {
          if (toolCall.type !== 'function') {
            continue;
          }

          let args: Record<string, unknown> = {};
          try {
            args = toolCall.function.arguments
              ? (JSON.parse(toolCall.function.arguments) as Record<
                  string,
                  unknown
                >)
              : {};
          } catch {
            args = {};
          }

          const result = await runTool(toolCall.function.name, args);
          toolsUsed.push(toolCall.function.name);

          workingMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }

      throw new ServiceUnavailableException(
        `Tool calling did not finish within ${maxRounds} rounds`,
      );
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
