import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WorkspaceService } from '../infrastructure/workspace.service';
import { RailpackService } from '../infrastructure/railpack.service';
import { DockerService } from '../infrastructure/docker.service';
import { CaddyService } from '../infrastructure/caddy.service';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { Deployment, DeploymentStatus } from '@prisma/client';
import type { Container } from 'dockerode';

@Injectable()
export class DeploymentsService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly railpackService: RailpackService,
    private readonly dockerService: DockerService,
    private readonly caddyService: CaddyService,
    private readonly logService: LogService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing recovery logic for deployments...');
    const runningDeployments = await this.prisma.deployment.findMany({
      where: {
        status: {
          in: [DeploymentStatus.RUNNING, DeploymentStatus.DEPLOYING],
        },
      },
    });

    for (const dep of runningDeployments) {
      try {
        const containerName = `mavrick-app-${dep.id}`;
        const containers = await this.dockerService.listContainers();
        const existing = containers.find((c) =>
          c.Names.includes(`/${containerName}`),
        );

        if (existing) {
          if (existing.State !== 'running') {
            this.logger.log(`Restarting container for deployment ${dep.id}`);
            await this.dockerService.startContainer(existing.Id);
          }
        } else if (dep.imageTag) {
          this.logger.log(`Recreating container for deployment ${dep.id}`);
          const container = await this.dockerService.createContainer(
            dep.imageTag,
            containerName,
            [`PORT=8080`],
          );
          await this.dockerService.startContainer(container.id);
          // Update containerId in DB
          await this.prisma.deployment.update({
            where: { id: dep.id },
            data: { containerId: container.id },
          });
        }

        // Re-register in Caddy
        await this.caddyService.registerRoute(dep.id, containerName, 8080);
        this.logger.log(`Recovered deployment ${dep.id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to recover deployment ${dep.id}: ${message}`);
      }
    }
  }

  async createDeployment(gitUrl: string) {
    const id = randomUUID().substring(0, 8);
    const deployment = await this.prisma.deployment.create({
      data: {
        id,
        gitUrl,
        status: DeploymentStatus.PENDING,
      },
    });

    // Start build process in background
    this.processDeployment(id).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Deployment ${id} failed: ${message}`);
    });

    return deployment;
  }

  async createDeploymentFromFile(buffer: Buffer) {
    const id = randomUUID().substring(0, 8);
    const deployment: Deployment = await this.prisma.deployment.create({
      data: {
        id,
        status: DeploymentStatus.PENDING,
      },
    });

    // We store the buffer in memory temporarily for the background process
    // In a real system, you might store it in S3 or a temp file
    this.processDeployment(id, buffer).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Deployment ${id} failed: ${message}`);
    });

    return deployment;
  }

  async processDeployment(id: string, fileBuffer?: Buffer) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });
    if (!deployment) return;

    try {
      await this.updateStatus(id, DeploymentStatus.BUILDING);
      await this.logService.appendLog(
        id,
        `Starting deployment for ${deployment.gitUrl || 'uploaded file'}\n`,
      );

      let workspacePath = await this.workspaceService.createWorkspace(id);
      if (deployment.gitUrl) {
        await this.workspaceService.cloneRepo(deployment.gitUrl, workspacePath);
      } else if (fileBuffer) {
        this.workspaceService.extractZip(fileBuffer, workspacePath);
        // Find the actual project root (in case of nested folders)
        workspacePath =
          await this.workspaceService.findProjectRoot(workspacePath);
      } else {
        throw new Error('No source provided for deployment');
      }

      const imageTag = `mavrick-${id}`;
      await this.prisma.deployment.update({
        where: { id },
        data: { imageTag },
      });
      await this.railpackService.build(workspacePath, imageTag, id);

      await this.updateStatus(id, DeploymentStatus.DEPLOYING);
      await this.logService.appendLog(
        id,
        `Build finished. Starting container...\n`,
      );

      const containerName = `mavrick-app-${id}`;
      const container: Container = await this.dockerService.createContainer(
        imageTag,
        containerName,
        [`PORT=8080`],
      );
      await this.dockerService.startContainer(container.id);
      await this.prisma.deployment.update({
        where: { id },
        data: { containerId: container.id },
      });

      await this.logService.appendLog(
        id,
        `Container started. Registering Caddy route...\n`,
      );
      await this.caddyService.registerRoute(id, containerName, 8080);

      const publicUrl = `http://${id}.localhost`;
      await this.prisma.deployment.update({
        where: { id },
        data: {
          publicUrl,
          status: DeploymentStatus.RUNNING,
        },
      });
      await this.logService.appendLog(
        id,
        `Successfully deployed! URL: ${publicUrl}\n`,
      );
      await this.logService.appendLog(id, `--- Build complete ---\n`);
      this.logService.completeLog(id);

      // Cleanup workspace after build
      await this.workspaceService.cleanupWorkspace(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      await this.updateStatus(id, DeploymentStatus.FAILED);
      await this.logService.appendLog(id, `ERROR: ${message}\n`);
      this.logService.completeLog(id);
      this.logger.error(`Deployment ${id} failed`, stack);
    }
  }

  private async updateStatus(id: string, status: DeploymentStatus) {
    await this.prisma.deployment.update({
      where: { id },
      data: { status },
    });
  }

  async findAll() {
    return this.prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.deployment.findUnique({ where: { id } });
  }
}
