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

export interface ToolChatResult {
  reply: string;
  toolsUsed: string[];
  model: string;
  provider: string;
  usage: TokenUsage;
}

export interface GatewayMeta {
  requestId: string;
  costUsd: number;
  latencyMs: number;
}

export type GatewayChatResult = ChatResult & GatewayMeta;
export type GatewayStructuredChatResult = StructuredChatResult & GatewayMeta;
export type GatewayToolChatResult = ToolChatResult & GatewayMeta;

import type { RetrievalMode } from '../gateway/retrieval-mode';

export type LlmCallOptions = {
  requestId?: string;
  /** RAG depth label from the UI (omit for non-query calls). */
  retrievalMode?: RetrievalMode;
  /** Chunks retrieved for this query (logged on embed + generate). */
  topK?: number;
};

export type LlmProviderName = 'ollama' | 'gemini' | 'openai';

export interface LlmProvider {
  readonly name: LlmProviderName;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
  chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult>;
  chatWithTools(messages: ChatMessage[]): Promise<ToolChatResult>;
  embed(text: string): Promise<number[]>;
}
