import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * The `embedding vector(768)` column is intentionally not mapped here.
 * TypeORM's Postgres driver has no native `vector` type, so we read/write it
 * with raw parameterized SQL (`$n::vector`) in DocumentsService instead.
 */
@Entity('document_chunks')
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column('text')
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
