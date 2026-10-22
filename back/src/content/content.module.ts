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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Drama,
      ProductionCompany,
      DramaGenre,
      Genre,
      ContentImage,
      ContentVideo,
      Episode,
    ]),
  ],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService, S3VideoUrlService],
  exports: [PublicCatalogService],
})
export class ContentModule {}
