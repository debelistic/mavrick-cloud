import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { simpleGit } from 'simple-git';
import AdmZip from 'adm-zip';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly baseDir = path.join(process.cwd(), 'workspaces');

  async createWorkspace(deploymentId: string): Promise<string> {
    const workspacePath = path.join(this.baseDir, deploymentId);
    await fs.mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }

  async cloneRepo(gitUrl: string, workspacePath: string): Promise<void> {
    this.logger.log(`Cloning ${gitUrl} into ${workspacePath}`);
    await simpleGit().clone(gitUrl, workspacePath);
  }

  extractZip(buffer: Buffer, workspacePath: string): void {
    this.logger.log(`Extracting zip to ${workspacePath}`);
    const zip = new AdmZip(buffer);
    zip.extractAllTo(workspacePath, true);
  }

  async findProjectRoot(workspacePath: string): Promise<string> {
    // Look for common project markers
    const markers = [
      'package.json',
      'go.mod',
      'requirements.txt',
      'Gemfile',
      'pom.xml',
      'build.gradle',
    ];

    const search = async (dir: string): Promise<string | null> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Check if any marker exists in the current directory
      for (const entry of entries) {
        if (entry.isFile() && markers.includes(entry.name)) {
          return dir;
        }
      }

      // If not found, recurse into directories (limit depth to 2 to avoid deep searches)
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          entry.name !== '__MACOSX' &&
          entry.name !== 'node_modules'
        ) {
          const found = await search(path.join(dir, entry.name));
          if (found) return found;
        }
      }

      return null;
    };

    const root = await search(workspacePath);
    return root || workspacePath; // Fallback to workspacePath if no markers found
  }

  async cleanupWorkspace(deploymentId: string): Promise<void> {
    const workspacePath = path.join(this.baseDir, deploymentId);
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to cleanup workspace ${deploymentId}: ${message}`,
      );
    }
  }

  getWorkspacePath(deploymentId: string): string {
    return path.join(this.baseDir, deploymentId);
  }
}
