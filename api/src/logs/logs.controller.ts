import { Controller, Sse, MessageEvent, Param } from '@nestjs/common';
import { LogService } from './log.service';
import { Observable, map } from 'rxjs';

@Controller('deployments/:id/logs')
export class LogsController {
  constructor(private readonly logService: LogService) {}

  @Sse()
  streamLogs(@Param('id') id: string): Observable<MessageEvent> {
    return this.logService.getLogStream(id).pipe(map((log) => ({ data: log })));
  }
}
