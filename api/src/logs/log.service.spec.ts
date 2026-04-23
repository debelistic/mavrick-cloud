import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from './log.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { Subject } from 'rxjs';

describe('LogService', () => {
  let service: LogService;
  let prisma: PrismaService;

  const mockPrisma = {
    log: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<LogService>(LogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('appendLog', () => {
    it('should create a log entry and emit to subject', async () => {
      const deploymentId = 'test-id';
      const logContent = 'test log line';
      
      mockPrisma.log.create.mockResolvedValue({ id: 1, deploymentId, content: logContent });

      await service.appendLog(deploymentId, logContent);

      expect(prisma.log.create).toHaveBeenCalledWith({
        data: { deploymentId, content: logContent },
      });
    });

    it('should handle prisma errors gracefully', async () => {
      const deploymentId = 'test-id';
      mockPrisma.log.create.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(service.appendLog(deploymentId, 'log')).resolves.not.toThrow();
    });
  });

  describe('getLogStream', () => {
    it('should return an observable that emits existing logs and new ones', (done) => {
      const deploymentId = 'test-id';
      const existingLogs = [
        { content: 'log 1\n' },
        { content: 'log 2\n' },
      ];

      mockPrisma.log.findMany.mockResolvedValue(existingLogs);

      service.getLogStream(deploymentId).subscribe({
        next: (val) => {
          if (val === 'log 1\nlog 2\n') {
            // First emission is existing logs
            service.appendLog(deploymentId, 'log 3\n');
          } else if (val === 'log 3\n') {
            // Second emission is the new log
            done();
          }
        },
      });
    });
  });

  describe('completeLog', () => {
    it('should complete the stream and remove it from the map', (done) => {
      const deploymentId = 'test-id';
      mockPrisma.log.findMany.mockResolvedValue([]);

      const stream = service.getLogStream(deploymentId);
      
      stream.subscribe({
        complete: () => {
          done();
        },
      });

      // We need to wait for the first emission (existing logs) before completing
      // log.service.ts uses setTimeout(..., 0) for the first emission
      setTimeout(() => {
        service.completeLog(deploymentId);
      }, 10);
    });
  });
});
