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
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicCatalogService } from './public-catalog.service.js';
import { LocalImageController } from './local-image.controller.js';

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
  controllers: [PublicCatalogController, LocalImageController],
  providers: [PublicCatalogService],
  exports: [PublicCatalogService],
})
export class ContentModule {}
