import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit } from 'simple-git';

jest.mock('fs/promises');
jest.mock('simple-git');
jest.mock('adm-zip', () => {
  return jest.fn().mockImplementation(() => ({
    extractAllTo: jest.fn(),
  }));
});

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkspaceService],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should create a directory for the deployment', async () => {
      const deploymentId = 'test-deploy';
      const expectedPath = path.join(process.cwd(), 'workspaces', deploymentId);
      
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createWorkspace(deploymentId);

      expect(fs.mkdir).toHaveBeenCalledWith(expectedPath, { recursive: true });
      expect(result).toBe(expectedPath);
    });
  });

  describe('cleanupWorkspace', () => {
    it('should remove the workspace directory', async () => {
      const deploymentId = 'test-deploy';
      const expectedPath = path.join(process.cwd(), 'workspaces', deploymentId);
      
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      await service.cleanupWorkspace(deploymentId);

      expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });
  });

  describe('cloneRepo', () => {
    it('should call simpleGit().clone', async () => {
      const gitUrl = 'https://github.com/test/repo.git';
      const workspacePath = '/tmp/test-workspace';
      const mockClone = jest.fn().mockResolvedValue(undefined);
      
      (simpleGit as jest.Mock).mockReturnValue({
        clone: mockClone,
      });

      await service.cloneRepo(gitUrl, workspacePath);

      expect(simpleGit).toHaveBeenCalled();
      expect(mockClone).toHaveBeenCalledWith(gitUrl, workspacePath);
    });
  });

  describe('findProjectRoot', () => {
    it('should return the current directory if package.json is found', async () => {
      const workspacePath = '/tmp/workspace';
      const mockEntries = [
        { isFile: () => true, isDirectory: () => false, name: 'package.json' },
      ];

      (fs.readdir as jest.Mock).mockResolvedValue(mockEntries);

      const result = await service.findProjectRoot(workspacePath);

      expect(result).toBe(workspacePath);
    });

    it('should recurse into subdirectories to find project root', async () => {
      const workspacePath = '/tmp/workspace';
      const subDirPath = path.join(workspacePath, 'my-app');
      
      // First call (root) returns one directory
      (fs.readdir as jest.Mock)
        .mockResolvedValueOnce([
          { isFile: () => false, isDirectory: () => true, name: 'my-app' },
        ])
        // Second call (my-app) returns package.json
        .mockResolvedValueOnce([
          { isFile: () => true, isDirectory: () => false, name: 'package.json' },
        ]);

      const result = await service.findProjectRoot(workspacePath);

      expect(result).toBe(subDirPath);
    });
  });
});
