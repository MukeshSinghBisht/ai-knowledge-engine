import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  content: string;

  @Column({ name: 'source_type', type: 'text', default: 'text' })
  sourceType: string;

  @Column({ name: 'content_hash', type: 'text', nullable: true })
  contentHash: string | null;

  @Column({ name: 'owner_id', type: 'text', nullable: true })
  ownerId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
