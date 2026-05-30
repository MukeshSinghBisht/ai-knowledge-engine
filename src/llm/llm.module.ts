import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Global()
@Module({
  providers: [OllamaProvider, GeminiProvider, OpenAiProvider, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
