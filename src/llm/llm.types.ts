export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  reply: string;
  model: string;
  provider: string;
  usage: TokenUsage;
}

export interface StructuredChatResult {
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
}

export type LlmProviderName = 'ollama' | 'gemini' | 'openai';

export interface LlmProvider {
  readonly name: LlmProviderName;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
  chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult>;
}
