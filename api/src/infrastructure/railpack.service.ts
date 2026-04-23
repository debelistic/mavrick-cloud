import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { LogService } from '../logs/log.service';

@Injectable()
export class RailpackService {
  constructor(private readonly logService: LogService) {}

  async build(path: string, tag: string, deploymentId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('railpack', ['build', path, '--name', tag], {
        shell: true,
      });

      child.stdout.on('data', (data: Buffer) => {
        void this.logService.appendLog(deploymentId, data.toString());
      });

      child.stderr.on('data', (data: Buffer) => {
        void this.logService.appendLog(deploymentId, data.toString());
      });

      child.on('close', (code) => {
        if (code === 0) {
          void this.logService
            .appendLog(deploymentId, 'Build successful!\n')
            .then(() => resolve());
        } else {
          void this.logService
            .appendLog(deploymentId, `Build failed with code ${code}\n`)
            .finally(() =>
              reject(new Error(`Railpack build failed with code ${code}`)),
            );
        }
      });
    });
  }
}
