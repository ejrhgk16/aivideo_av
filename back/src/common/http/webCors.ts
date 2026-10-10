import type { CorsOptions } from '@nestjs/common/internal';

export const WEB_CORS_ORIGIN = 'http://localhost:8081';

export function createWebCorsOptions(): CorsOptions {
  return {
    origin: (requestOrigin, callback) => {
      callback(
        null,
        requestOrigin === WEB_CORS_ORIGIN ? WEB_CORS_ORIGIN : false,
      );
    },
  };
}
