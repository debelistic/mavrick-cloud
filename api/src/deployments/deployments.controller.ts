import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeploymentsService } from './deployments.service';

@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body('gitUrl') gitUrl: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!gitUrl && !file) {
      throw new Error('gitUrl or file is required');
    }

    if (gitUrl) {
      return this.deploymentsService.createDeployment(gitUrl);
    }

    return this.deploymentsService.createDeploymentFromFile(file.buffer);
  }

  @Get()
  async findAll() {
    return this.deploymentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const deployment = await this.deploymentsService.findOne(id);
    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${id} not found`);
    }
    return deployment;
  }
}
