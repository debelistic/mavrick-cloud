/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { WorkspaceService } from '../infrastructure/workspace.service';
import { RailpackService } from '../infrastructure/railpack.service';
import { DockerService } from '../infrastructure/docker.service';
import { CaddyService } from '../infrastructure/caddy.service';
import { LogService } from '../logs/log.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { DeploymentStatus } from '@prisma/client';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let prisma: PrismaService;
  let workspaceService: WorkspaceService;
  let railpackService: RailpackService;
  let dockerService: DockerService;
  let caddyService: CaddyService;
  let logService: LogService;

  const mockPrisma = {
    deployment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockWorkspaceService = {
    createWorkspace: jest.fn(),
    cloneRepo: jest.fn(),
    extractZip: jest.fn(),
    findProjectRoot: jest.fn(),
    cleanupWorkspace: jest.fn(),
  };

  const mockRailpackService = {
    build: jest.fn(),
  };

  const mockDockerService = {
    listContainers: jest.fn(),
    createContainer: jest.fn(),
    startContainer: jest.fn(),
  };

  const mockCaddyService = {
    registerRoute: jest.fn(),
  };

  const mockLogService = {
    appendLog: jest.fn(),
    completeLog: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: RailpackService, useValue: mockRailpackService },
        { provide: DockerService, useValue: mockDockerService },
        { provide: CaddyService, useValue: mockCaddyService },
        { provide: LogService, useValue: mockLogService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    workspaceService = module.get<WorkspaceService>(WorkspaceService);
    railpackService = module.get<RailpackService>(RailpackService);
    dockerService = module.get<DockerService>(DockerService);
    caddyService = module.get<CaddyService>(CaddyService);
    logService = module.get<LogService>(LogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeployment', () => {
    it('should create a pending deployment and start processing', async () => {
      const gitUrl = 'https://github.com/test/repo.git';
      mockPrisma.deployment.create.mockResolvedValue({
        id: 'test-id',
        gitUrl,
        status: DeploymentStatus.PENDING,
      });
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id: 'test-id',
        gitUrl,
        status: DeploymentStatus.PENDING,
      });

      const result = await service.createDeployment(gitUrl);

      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          gitUrl,
          status: DeploymentStatus.PENDING,
        },
      });
      expect(result.gitUrl).toBe(gitUrl);
    });
  });

  describe('processDeployment', () => {
    it('should complete the full deployment lifecycle successfully', async () => {
      const id = 'test-id';
      const gitUrl = 'https://github.com/test/repo.git';
      const workspacePath = '/workspaces/test-id';
      const imageTag = `mavrick-${id}`;
      const containerId = 'cont-123';
      const containerName = `mavrick-app-${id}`;

      mockPrisma.deployment.findUnique.mockResolvedValue({ id, gitUrl });
      mockWorkspaceService.createWorkspace.mockResolvedValue(workspacePath);
      mockDockerService.createContainer.mockResolvedValue({ id: containerId });

      await service.processDeployment(id);

      // Verify building state
      expect(prisma.deployment.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: DeploymentStatus.BUILDING },
      });

      // Verify build call
      expect(railpackService.build).toHaveBeenCalledWith(
        workspacePath,
        imageTag,
        id,
      );

      // Verify deploying state
      expect(prisma.deployment.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: DeploymentStatus.DEPLOYING },
      });

      // Verify container creation and start
      expect(dockerService.createContainer).toHaveBeenCalledWith(
        imageTag,
        containerName,
        ['PORT=8080'],
      );
      expect(dockerService.startContainer).toHaveBeenCalledWith(containerId);

      // Verify Caddy registration
      expect(caddyService.registerRoute).toHaveBeenCalledWith(
        id,
        containerName,
        8080,
      );

      // Verify running state
      expect(prisma.deployment.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          publicUrl: `http://${id}.localhost`,
          status: DeploymentStatus.RUNNING,
        },
      });

      // Verify cleanup
      expect(workspaceService.cleanupWorkspace).toHaveBeenCalledWith(id);
      expect(logService.completeLog).toHaveBeenCalledWith(id);
    });

    it('should handle failures and update status to FAILED', async () => {
      const id = 'test-id';
      mockPrisma.deployment.findUnique.mockResolvedValue({
        id,
        gitUrl: 'invalid',
      });
      mockWorkspaceService.createWorkspace.mockRejectedValue(
        new Error('Workspace error'),
      );

      await service.processDeployment(id);

      expect(prisma.deployment.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: DeploymentStatus.FAILED },
      });
      expect(logService.appendLog).toHaveBeenCalledWith(
        id,
        expect.stringContaining('ERROR: Workspace error'),
      );
    });
  });

  describe('onModuleInit', () => {
    it('should recover running deployments', async () => {
      const dep = {
        id: 'running-id',
        status: DeploymentStatus.RUNNING,
        imageTag: 'tag',
      };
      mockPrisma.deployment.findMany.mockResolvedValue([dep]);
      mockDockerService.listContainers.mockResolvedValue([]);
      mockDockerService.createContainer.mockResolvedValue({ id: 'new-cont' });

      await service.onModuleInit();

      expect(dockerService.createContainer).toHaveBeenCalled();
      expect(caddyService.registerRoute).toHaveBeenCalled();
    });
  });
});
