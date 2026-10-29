import type { CorsOptions } from '@nestjs/common/internal';

export const WEB_CORS_ORIGIN = 'http://localhost:8081';

export function getWebCorsOrigins(): string[] {
  const configured = process.env.WEB_CORS_ORIGINS;
  if (configured === undefined) {
    return process.env.NODE_ENV === 'production' ? [] : [WEB_CORS_ORIGIN];
  }
  return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}

export function createWebCorsOptions(): CorsOptions {
  return {
    origin: (requestOrigin, callback) => {
      callback(
        null,
        requestOrigin && getWebCorsOrigins().includes(requestOrigin) ? requestOrigin : false,
      );
    },
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-auth-transport'],
  };
}
