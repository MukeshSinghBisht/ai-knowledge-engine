import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { GatewayLogService } from './gateway-log.service';

class GatewayLogsQueryDto {
  @ApiPropertyOptional({
    example: 20,
    description: 'Max rows (1–100, default 20)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiTags('gateway')
@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayLog: GatewayLogService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Recent AI Gateway telemetry rows',
    description:
      'Returns the latest llm_gateway_logs entries (cost, latency, retrieval mode). Useful for demos without SQL.',
  })
  @ApiOkResponse({ description: 'Newest gateway log rows first' })
  listLogs(@Query() query: GatewayLogsQueryDto) {
    return this.gatewayLog.listRecent(query.limit ?? 20);
  }
}
