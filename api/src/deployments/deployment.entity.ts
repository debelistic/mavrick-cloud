export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  RUNNING = 'running',
  FAILED = 'failed',
}

export interface Deployment {
  id: string;
  gitUrl?: string;
  sourceFile?: Buffer;
  status: DeploymentStatus;
  createdAt: Date;
  updatedAt: Date;
  publicUrl?: string;
  containerId?: string;
  imageTag?: string;
}
