import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
  parseFallbackOrder,
  parsePositiveInt,
  parseProviderName,
  resolveProviderChain,
} from '../gateway/fallback-order';
import { GatewayLogService } from '../gateway/gateway-log.service';
import { GatewayOperation } from '../gateway/gateway-operation';
import { calculateCostUsd, resolveCostRates } from '../gateway/llm-cost';
import { TimeoutError, withTimeout } from '../gateway/with-timeout';
import {
  ChatMessage,
  ChatResult,
  EmbeddingTaskType,
  GatewayChatResult,
  GatewayStructuredChatResult,
  GatewayToolChatResult,
  LlmCallOptions,
  LlmProvider,
  LlmProviderName,
  ProviderAttempt,
  StructuredChatResult,
  ToolChatResult,
} from './llm.types';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Injectable()
export class LlmService {
  private readonly providerName: LlmProviderName;
  /** Embeddings stay here so vector dims match ingest (no cross-provider fallback). */
  private readonly embeddingProviderName: LlmProviderName;
  private readonly providerChain: LlmProviderName[];
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly ollamaProvider: OllamaProvider,
    private readonly cloudflareProvider: CloudflareProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly groqProvider: GroqProvider,
    private readonly gatewayLog: GatewayLogService,
  ) {
    this.providerName = parseProviderName(
      this.configService.get<string>('LLM_PROVIDER'),
    );
    this.embeddingProviderName = parseProviderName(
      this.configService.get<string>('LLM_EMBEDDING_PROVIDER'),
      this.providerName,
    );

    const fallbackOrder = parseFallbackOrder(
      this.configService.get<string>('LLM_FALLBACK_ORDER'),
    );
    const maxAttempts = parsePositiveInt(
      this.configService.get<string>('LLM_MAX_ATTEMPTS'),
      DEFAULT_MAX_ATTEMPTS,
    );
    this.timeoutMs = parsePositiveInt(
      this.configService.get<string>('LLM_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS,
    );
    this.providerChain = resolveProviderChain(
      this.providerName,
      fallbackOrder,
      maxAttempts,
    );
  }

  get activeProvider(): LlmProviderName {
    return this.providerName;
  }

  get embeddingProvider(): LlmProviderName {
    return this.embeddingProviderName;
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

  /** Embeddings use LLM_EMBEDDING_PROVIDER (defaults to LLM_PROVIDER); no cross-provider fallback. */
  async embed(
    text: string,
    options?: LlmCallOptions,
    taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[]> {
    const requestId = options?.requestId ?? randomUUID();
    const started = Date.now();
    const provider = this.getProvider(this.embeddingProviderName);
    const vector = await provider.embed(text, taskType);
    const latencyMs = Date.now() - started;

    this.gatewayLog.record({
      requestId,
      operation: GatewayOperation.Embed,
      provider: provider.name,
      model: this.embeddingModelName(provider.name),
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs,
      retrievalMode: options?.retrievalMode ?? null,
      topK: options?.topK ?? null,
      attempt: 1,
      outcome: 'success',
    });

    return vector;
  }

  private async instrument<
    T extends ChatResult | StructuredChatResult | ToolChatResult,
  >(
    operation: Exclude<GatewayOperation, GatewayOperation.Embed>,
    run: (provider: LlmProvider) => Promise<T>,
    options?: LlmCallOptions,
  ): Promise<
    T & {
      requestId: string;
      costUsd: number;
      latencyMs: number;
      attempts: ProviderAttempt[];
    }
  > {
    const requestId = options?.requestId ?? randomUUID();
    const attempts: ProviderAttempt[] = [];
    const errors: string[] = [];

    for (let i = 0; i < this.providerChain.length; i++) {
      const providerName = this.providerChain[i];
      const attemptNumber = i + 1;
      const provider = this.getProvider(providerName);
      const rates = resolveCostRates(providerName, this.tokenCostEnv());
      const started = Date.now();

      try {
        const result = await withTimeout(run(provider), this.timeoutMs);
        const latencyMs = Date.now() - started;
        const costUsd = calculateCostUsd(result.usage, rates);

        attempts.push({
          attempt: attemptNumber,
          provider: providerName,
          outcome: 'success',
          latencyMs,
        });

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
          attempt: attemptNumber,
          outcome: 'success',
        });

        return { ...result, requestId, costUsd, latencyMs, attempts };
      } catch (error) {
        const latencyMs = Date.now() - started;
        const isTimeout = error instanceof TimeoutError;
        const failureReason = isTimeout
          ? `Timed out after ${this.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error);

        attempts.push({
          attempt: attemptNumber,
          provider: providerName,
          outcome: isTimeout ? 'timeout' : 'error',
          latencyMs,
          failureReason,
        });

        this.gatewayLog.record({
          requestId,
          operation,
          provider: providerName,
          model: this.chatModelName(providerName),
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs,
          retrievalMode: options?.retrievalMode ?? null,
          topK: options?.topK ?? null,
          attempt: attemptNumber,
          outcome: isTimeout ? 'timeout' : 'error',
          failureReason,
        });

        errors.push(`${providerName}: ${failureReason}`);
      }
    }

    throw new ServiceUnavailableException(
      `All LLM providers failed after ${attempts.length} attempt(s): ${errors.join(' | ')}`,
    );
  }

  private tokenCostEnv() {
    return {
      ollamaInput: this.configService.get<string>('OLLAMA_INPUT_USD_PER_1M'),
      ollamaOutput: this.configService.get<string>('OLLAMA_OUTPUT_USD_PER_1M'),
      openaiInput: this.configService.get<string>('OPENAI_INPUT_USD_PER_1M'),
      openaiOutput: this.configService.get<string>('OPENAI_OUTPUT_USD_PER_1M'),
      geminiInput: this.configService.get<string>('GEMINI_INPUT_USD_PER_1M'),
      geminiOutput: this.configService.get<string>('GEMINI_OUTPUT_USD_PER_1M'),
      groqInput: this.configService.get<string>('GROQ_INPUT_USD_PER_1M'),
      groqOutput: this.configService.get<string>('GROQ_OUTPUT_USD_PER_1M'),
      cloudflareInput: this.configService.get<string>(
        'CLOUDFLARE_INPUT_USD_PER_1M',
      ),
      cloudflareOutput: this.configService.get<string>(
        'CLOUDFLARE_OUTPUT_USD_PER_1M',
      ),
    };
  }

  private chatModelName(provider: LlmProviderName): string {
    if (provider === 'openai') {
      return (
        this.configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini'
      );
    }
    if (provider === 'gemini') {
      return (
        this.configService.get<string>('GEMINI_CHAT_MODEL') ??
        'gemini-3.8-flash'
      );
    }
    if (provider === 'groq') {
      return (
        this.configService.get<string>('GROQ_CHAT_MODEL') ??
        'llama-3.3-70b-versatile'
      );
    }
    if (provider === 'cloudflare') {
      return (
        this.configService.get<string>('CLOUDFLARE_CHAT_MODEL') ??
        '@cf/meta/llama-3.2-3b-instruct'
      );
    }
    return this.configService.get<string>('OLLAMA_CHAT_MODEL') ?? 'llama3.2';
  }

  private embeddingModelName(provider: LlmProviderName): string {
    if (provider === 'openai') {
      return (
        this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
        'text-embedding-3-small'
      );
    }
    if (provider === 'gemini') {
      return (
        this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
        'gemini-embedding-2'
      );
    }
    return (
      this.configService.get<string>('OLLAMA_EMBEDDING_MODEL') ??
      'nomic-embed-text'
    );
  }

  private getProvider(name: LlmProviderName): LlmProvider {
    switch (name) {
      case 'ollama':
        return this.ollamaProvider;
      case 'gemini':
        return this.geminiProvider;
      case 'openai':
        return this.openAiProvider;
      case 'groq':
        return this.groqProvider;
      case 'cloudflare':
        return this.cloudflareProvider;
      default:
        throw new ServiceUnavailableException(
          `Unsupported LLM provider: ${String(name)}. Use: ollama | gemini | openai | groq | cloudflare`,
        );
    }
  }
}
