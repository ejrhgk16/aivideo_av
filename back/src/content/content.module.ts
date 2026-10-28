import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Drama,
  DramaGenre,
  ContentImage,
  ContentVideo,
  Episode,
  Genre,
  ProductionCompany,
} from './entities/index.js';
import { PublicCatalogController } from './publicCatalogController.js';
import { PublicCatalogService } from './publicCatalogService.js';
import { S3VideoUrlService } from './s3VideoUrlService.js';
import { User } from '../identity/entities/index.js';
import { IdentityModule } from '../identity/identity.module.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([
      Drama,
      ProductionCompany,
      DramaGenre,
      Genre,
      ContentImage,
      ContentVideo,
      Episode,
      User,
    ]),
  ],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService, S3VideoUrlService],
  exports: [PublicCatalogService],
})
export class ContentModule {}
