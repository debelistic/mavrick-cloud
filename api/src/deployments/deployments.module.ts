import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { LogModule } from '../logs/log.module';

@Module({
  imports: [InfrastructureModule, LogModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
})
export class DeploymentsModule {}
