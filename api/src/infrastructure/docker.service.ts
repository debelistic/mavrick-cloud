import { Injectable, OnModuleInit } from '@nestjs/common';
import Docker from 'dockerode';

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Docker;

  onModuleInit() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async createContainer(
    image: string,
    name: string,
    env: string[] = [],
  ): Promise<Docker.Container> {
    const container = await this.docker.createContainer({
      Image: image,
      name: name,
      Env: env,
      HostConfig: {
        NetworkMode: 'deploy_net',
      },
    });
    return container;
  }

  async startContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.start();
  }

  async stopContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.stop();
  }

  async removeContainer(id: string) {
    const container = this.docker.getContainer(id);
    await container.remove();
  }

  async getContainerInfo(id: string) {
    const container = this.docker.getContainer(id);
    return await container.inspect();
  }

  async listContainers(all: boolean = true) {
    return await this.docker.listContainers({ all });
  }
}
