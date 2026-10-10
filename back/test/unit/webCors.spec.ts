import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppService } from '../../src/app.service.js';
import {
  createWebCorsOptions,
  WEB_CORS_ORIGIN,
} from '../../src/common/http/webCors.js';

@Controller('collections')
class CorsTestCollectionController {
  @Get('HOME_FEATURED')
  getCollection() {
    return { code: 'HOME_FEATURED' };
  }
}

@Module({
  controllers: [CorsTestCollectionController],
  providers: [AppService],
})
class CorsTestModule {}

describe('web CORS', () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(CorsTestModule, { logger: false });
    app.enableCors(createWebCorsOptions());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the web origin for preflight and GET requests', async () => {
    const preflight = await fetch(`${baseUrl}/collections/HOME_FEATURED`, {
      method: 'OPTIONS',
      headers: {
        Origin: WEB_CORS_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    const response = await fetch(`${baseUrl}/collections/HOME_FEATURED`, {
      headers: { Origin: WEB_CORS_ORIGIN },
    });

    expect(preflight.headers.get('access-control-allow-origin')).toBe(
      WEB_CORS_ORIGIN,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      WEB_CORS_ORIGIN,
    );
  });

  it('does not allow another origin', async () => {
    const response = await fetch(`${baseUrl}/collections/HOME_FEATURED`, {
      headers: { Origin: 'http://localhost:8082' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
