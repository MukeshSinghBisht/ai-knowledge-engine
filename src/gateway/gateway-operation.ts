/** Allowed values for llm_gateway_logs.operation (Postgres enum llm_gateway_operation). */
export enum GatewayOperation {
  /** Free-form chat and structured JSON extraction share this bucket. */
  Generate = 'generate',
  Tools = 'tools',
  Embed = 'embed',
}

export const GATEWAY_OPERATIONS = Object.values(GatewayOperation);

export const LLM_GATEWAY_OPERATION_ENUM = 'llm_gateway_operation';
