import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, from } from 'rxjs';
import { PrismaService } from '../infrastructure/prisma.service';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);
  private logStreams = new Map<string, Subject<string>>();

  constructor(private readonly prisma: PrismaService) {}

  getLogStream(deploymentId: string): Observable<string> {
    if (!this.logStreams.has(deploymentId)) {
      this.logStreams.set(deploymentId, new Subject<string>());
    }

    // Get existing logs and then follow the stream
    return from(
      this.prisma.log.findMany({
        where: { deploymentId },
        orderBy: { createdAt: 'asc' },
      }),
    ).pipe(
      switchMap((existingLogs) => {
        const stream = this.logStreams.get(deploymentId)!;
        const existingContent = existingLogs.map((l) => l.content).join('');

        // Use a wrapper to emit existing logs first
        const subject = new Subject<string>();
        setTimeout(() => {
          if (existingContent) subject.next(existingContent);
          stream.subscribe({
            next: (v) => subject.next(v),
            error: (e) => subject.error(e),
            complete: () => subject.complete(),
          });
        }, 0);

        return subject.asObservable();
      }),
    );
  }

  async appendLog(deploymentId: string, log: string) {
    if (!this.logStreams.has(deploymentId)) {
      this.logStreams.set(deploymentId, new Subject<string>());
    }

    await this.prisma.log
      .create({
        data: {
          deploymentId,
          content: log,
        },
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to persist log: ${message}`);
      });

    this.logStreams.get(deploymentId)?.next(log);
  }

  completeLog(deploymentId: string) {
    const stream = this.logStreams.get(deploymentId);
    if (stream) {
      stream.complete();
      this.logStreams.delete(deploymentId);
    }
  }
}
