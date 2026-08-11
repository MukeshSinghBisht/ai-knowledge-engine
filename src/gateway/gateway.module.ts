import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmGatewayLogEntity } from './entities/llm-gateway-log.entity';
import { GatewayController } from './gateway.controller';
import { GatewayLogService } from './gateway-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([LlmGatewayLogEntity])],
  controllers: [GatewayController],
  providers: [GatewayLogService],
  exports: [GatewayLogService],
})
export class GatewayModule {}
