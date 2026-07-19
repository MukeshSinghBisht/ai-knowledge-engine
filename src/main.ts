import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Knowledge Engine')
    .setDescription(
      'Phase 1 chat API. Providers: Ollama (default) | Gemini | OpenAI. Set LLM_PROVIDER in .env.',
    )
    .setVersion('0.1.0')
    .addTag('health', 'Service health')
    .addTag('chat', 'LLM chat completions (Gemini or OpenAI)')
    .addTag('documents', 'Document ingestion + semantic search (pgvector)')
    .addTag('query', 'RAG: ask questions answered from stored documents')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);

  console.log(`API:     http://localhost:${port}`);
  console.log(`Swagger: http://localhost:${port}/docs`);
  console.log(`OpenAPI: http://localhost:${port}/docs-json`);
}
bootstrap();
