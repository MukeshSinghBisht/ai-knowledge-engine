import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  GatewayOperation,
  LLM_GATEWAY_OPERATION_ENUM,
} from '../gateway-operation';
import {
  LLM_RETRIEVAL_MODE_ENUM,
  RetrievalMode,
} from '../retrieval-mode';

@Entity('llm_gateway_logs')
export class LlmGatewayLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id', type: 'text' })
  requestId: string;

  @Column({
    type: 'enum',
    enum: GatewayOperation,
    enumName: LLM_GATEWAY_OPERATION_ENUM,
  })
  operation: GatewayOperation;

  @Column({ type: 'text' })
  provider: string;

  @Column({ type: 'text' })
  model: string;

  @Column({
    name: 'retrieval_mode',
    type: 'enum',
    enum: RetrievalMode,
    enumName: LLM_RETRIEVAL_MODE_ENUM,
    nullable: true,
  })
  retrievalMode: RetrievalMode | null;

  @Column({ name: 'top_k', type: 'int', nullable: true })
  topK: number | null;

  @Column({ name: 'input_tokens', type: 'int', default: 0 })
  inputTokens: number;

  @Column({ name: 'output_tokens', type: 'int', default: 0 })
  outputTokens: number;

  @Column({ name: 'cost_usd', type: 'numeric', precision: 14, scale: 8, default: 0 })
  costUsd: string;

  @Column({ name: 'latency_ms', type: 'int' })
  latencyMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
