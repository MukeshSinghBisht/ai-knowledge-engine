export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type LlmProviderName = 'ollama' | 'gemini' | 'openai';

export interface LlmProvider {
  readonly name: LlmProviderName;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
}
