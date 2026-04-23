import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CaddyService {
  private readonly logger = new Logger(CaddyService.name);
  private readonly caddyUrl =
    process.env.CADDY_ADMIN_URL || 'http://localhost:2019';

  async registerRoute(
    deploymentId: string,
    containerName: string,
    port: number = 8080,
  ) {
    const host = `${deploymentId}.localhost`;
    const upstream = `${containerName}:${port}`;

    const route = {
      '@id': `route-${deploymentId}`,
      match: [{ host: [host] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: upstream }],
          headers: {
            response: {
              delete: [
                'Strict-Transport-Security',
                'Content-Security-Policy',
                'Cross-Origin-Opener-Policy',
                'Cross-Origin-Embedder-Policy',
                'Cross-Origin-Resource-Policy',
              ],
            },
          },
        },
      ],
      terminal: true,
    };

    try {
      // Prepend to the routes list to ensure priority over generic platform routes
      await axios.put(
        `${this.caddyUrl}/config/apps/http/servers/srv0/routes/0`,
        route,
      );
      this.logger.log(`Registered Caddy route for ${host} -> ${upstream}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register Caddy route: ${message}`);
      throw error;
    }
  }
}
