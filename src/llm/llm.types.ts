import type { RetrievalMode } from '../gateway/retrieval-mode';

export type LlmProviderName =
  | 'ollama'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'cloudflare';
export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

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

export type ProviderAttemptOutcome = 'success' | 'timeout' | 'error';

export interface ProviderAttempt {
  attempt: number;
  provider: LlmProviderName;
  outcome: ProviderAttemptOutcome;
  latencyMs: number;
  failureReason?: string;
}

export interface GatewayMeta {
  requestId: string;
  costUsd: number;
  latencyMs: number;
  attempts: ProviderAttempt[];
}

export type GatewayChatResult = ChatResult & GatewayMeta;
export type GatewayStructuredChatResult = StructuredChatResult & GatewayMeta;
export type GatewayToolChatResult = ToolChatResult & GatewayMeta;

export type LlmCallOptions = {
  requestId?: string;
  /** RAG depth label from the UI (omit for non-query calls). */
  retrievalMode?: RetrievalMode;
  /** Chunks retrieved for this query (logged on embed + generate). */
  topK?: number;
};

export interface LlmProvider {
  readonly name: LlmProviderName;
  chat(messages: ChatMessage[]): Promise<ChatResult>;
  chatStructured(messages: ChatMessage[]): Promise<StructuredChatResult>;
  chatWithTools(messages: ChatMessage[]): Promise<ToolChatResult>;
  embed(text: string, taskType?: EmbeddingTaskType): Promise<number[]>;
}
