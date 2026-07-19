import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatMessage,
  ChatResult,
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

  chat(messages: ChatMessage[]): Promise<ChatResult> {
    return this.getProvider().chat(messages);
  }

  chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult> {
    return this.getProvider().chatStructured(messages);
  }

  chatWithTools(messages: ChatMessage[]): Promise<ToolChatResult> {
    return this.getProvider().chatWithTools(messages);
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
