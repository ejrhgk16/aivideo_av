import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { createDatabaseOptions } from './common/database/databaseConfig.js';
import { ContentModule } from './content/content.module.js';
import { EconomyModule } from './economy/economy.module.js';
import { ProgrammingModule } from './programming/programming.module.js';
import { IdentityModule } from './identity/identity.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createDatabaseOptions(process.env),
    }),
    ContentModule,
    EconomyModule,
    ProgrammingModule,
    IdentityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
