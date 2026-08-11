/** UI / product retrieval depth for RAG queries. */
export enum RetrievalMode {
  Simple = 'simple',
  Thorough = 'thorough',
}

export const RETRIEVAL_MODE_TOP_K: Record<RetrievalMode, number> = {
  [RetrievalMode.Simple]: 2,
  [RetrievalMode.Thorough]: 12,
};

export const LLM_RETRIEVAL_MODE_ENUM = 'llm_retrieval_mode';
