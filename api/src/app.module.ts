import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { LogModule } from './logs/log.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { DeploymentsModule } from './deployments/deployments.module';

@Module({
  imports: [PrismaModule, LogModule, InfrastructureModule, DeploymentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
