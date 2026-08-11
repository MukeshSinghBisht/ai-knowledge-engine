import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { GatewayLogService } from '../gateway/gateway-log.service';
import { GatewayOperation } from '../gateway/gateway-operation';
import { calculateCostUsd, resolveCostRates } from '../gateway/llm-cost';
import {
  ChatMessage,
  ChatResult,
  GatewayChatResult,
  GatewayStructuredChatResult,
  GatewayToolChatResult,
  LlmCallOptions,
  LlmProvider,
  LlmProviderName,
  StructuredChatResult,
  ToolChatResult,
} from './llm.types';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';

const SUPPORTED_PROVIDERS: LlmProviderName[] = ['ollama', 'gemini', 'openai'];

@Injectable()
export class LlmService {
  private readonly providerName: LlmProviderName;

  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaProvider: OllamaProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly gatewayLog: GatewayLogService,
  ) {
    const configured = this.configService
      .get<string>('LLM_PROVIDER')
      ?.toLowerCase() as LlmProviderName | undefined;

    if (configured && SUPPORTED_PROVIDERS.includes(configured)) {
      this.providerName = configured;
      return;
    }

    this.providerName = 'ollama';
  }

  get activeProvider(): LlmProviderName {
    return this.providerName;
  }

  chat(
    messages: ChatMessage[],
    options?: LlmCallOptions,
  ): Promise<GatewayChatResult> {
    return this.instrument(
      GatewayOperation.Generate,
      (provider) => provider.chat(messages),
      options,
    );
  }

  chatStructured(
    messages: ChatMessage[],
    options?: LlmCallOptions,
  ): Promise<GatewayStructuredChatResult> {
    return this.instrument(
      GatewayOperation.Generate,
      (provider) => provider.chatStructured(messages),
      options,
    );
  }

  chatWithTools(
    messages: ChatMessage[],
    options?: LlmCallOptions,
  ): Promise<GatewayToolChatResult> {
    return this.instrument(
      GatewayOperation.Tools,
      (provider) => provider.chatWithTools(messages),
      options,
    );
  }

  async embed(text: string, options?: LlmCallOptions): Promise<number[]> {
    const requestId = options?.requestId ?? randomUUID();
    const started = Date.now();
    const provider = this.getProvider();
    const vector = await provider.embed(text);
    const latencyMs = Date.now() - started;

    this.gatewayLog.record({
      requestId,
      operation: GatewayOperation.Embed,
      provider: provider.name,
      model: this.embeddingModelName(),
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs,
      retrievalMode: options?.retrievalMode ?? null,
      topK: options?.topK ?? null,
    });

    return vector;
  }

  private async instrument<T extends ChatResult | StructuredChatResult | ToolChatResult>(
    operation: Exclude<GatewayOperation, GatewayOperation.Embed>,
    run: (provider: LlmProvider) => Promise<T>,
    options?: LlmCallOptions,
  ): Promise<T & { requestId: string; costUsd: number; latencyMs: number }> {
    const requestId = options?.requestId ?? randomUUID();
    const provider = this.getProvider();
    const rates = resolveCostRates(provider.name, {
      ollamaInput: this.configService.get<string>('OLLAMA_INPUT_USD_PER_1M'),
      ollamaOutput: this.configService.get<string>('OLLAMA_OUTPUT_USD_PER_1M'),
      openaiInput: this.configService.get<string>('OPENAI_INPUT_USD_PER_1M'),
      openaiOutput: this.configService.get<string>('OPENAI_OUTPUT_USD_PER_1M'),
      geminiInput: this.configService.get<string>('GEMINI_INPUT_USD_PER_1M'),
      geminiOutput: this.configService.get<string>('GEMINI_OUTPUT_USD_PER_1M'),
    });

    const started = Date.now();
    const result = await run(provider);
    const latencyMs = Date.now() - started;
    const costUsd = calculateCostUsd(result.usage, rates);

    this.gatewayLog.record({
      requestId,
      operation,
      provider: result.provider,
      model: result.model,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      costUsd,
      latencyMs,
      retrievalMode: options?.retrievalMode ?? null,
      topK: options?.topK ?? null,
    });

    return { ...result, requestId, costUsd, latencyMs };
  }

  private embeddingModelName(): string {
    if (this.providerName === 'openai') {
      return (
        this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
        'text-embedding-3-small'
      );
    }
    if (this.providerName === 'gemini') {
      return (
        this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
        'text-embedding-004'
      );
    }
    return (
      this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ??
      'nomic-embed-text'
    );
  }

  private getProvider(): LlmProvider {
    switch (this.providerName) {
      case 'ollama':
        return this.ollamaProvider;
      case 'gemini':
        return this.geminiProvider;
      case 'openai':
        return this.openAiProvider;
      default:
        throw new ServiceUnavailableException(
          `Unsupported LLM_PROVIDER: ${this.providerName}. Use: ollama | gemini | openai`,
        );
    }
  }
}

