import { Global, Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { LlmService } from './llm.service';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Global()
@Module({
  imports: [GatewayModule],
  providers: [
    OllamaProvider,
    CloudflareProvider,
    GeminiProvider,
    OpenAiProvider,
    GroqProvider,
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
