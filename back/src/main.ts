import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createWebCorsOptions } from './common/http/webCors.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(createWebCorsOptions());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
