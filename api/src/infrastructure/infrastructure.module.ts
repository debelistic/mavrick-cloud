import { Module } from '@nestjs/common';
import { DockerService } from './docker.service';
import { RailpackService } from './railpack.service';
import { CaddyService } from './caddy.service';
import { WorkspaceService } from './workspace.service';
import { LogModule } from '../logs/log.module';

@Module({
  imports: [LogModule],
  providers: [DockerService, RailpackService, CaddyService, WorkspaceService],
  exports: [DockerService, RailpackService, CaddyService, WorkspaceService],
})
export class InfrastructureModule {}
