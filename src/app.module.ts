import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module';
import { DocumentsModule } from './documents/documents.module';
import { DocumentChunkEntity } from './documents/entities/document-chunk.entity';
import { DocumentEntity } from './documents/entities/document.entity';
import { HealthModule } from './health/health.module';
import { LlmModule } from './llm/llm.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'ai_knowledge'),
        entities: [DocumentEntity, DocumentChunkEntity],
        // Schema is created by db/init.sql (pgvector needs the vector type).
        synchronize: false,
        // Managed Postgres (Neon/Supabase/Render) requires SSL. Set DB_SSL=true.
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    // Global rate limit: protects the LLM-backed endpoints from abuse on a public URL.
    // 30 requests per minute per IP by default; override with THROTTLE_TTL/THROTTLE_LIMIT.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(config.get<string>('THROTTLE_TTL', '60'), 10) * 1000,
            limit: parseInt(config.get<string>('THROTTLE_LIMIT', '30'), 10),
          },
        ],
      }),
    }),
    LlmModule,
    HealthModule,
    ChatModule,
    DocumentsModule,
    QueryModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
