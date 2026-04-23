import { Module } from '@nestjs/common';
import { LogService } from './log.service';
import { LogsController } from './logs.controller';

@Module({
  controllers: [LogsController],
  providers: [LogService],
  exports: [LogService],
})
export class LogModule {}
