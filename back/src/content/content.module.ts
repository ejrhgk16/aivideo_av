import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Drama,
  DramaGenre,
  DramaImage,
  Episode,
  Genre,
  ProductionCompany,
} from './entities/index.js';
import { PublicCatalogController } from './public-catalog.controller.js';
import { PublicCatalogService } from './public-catalog.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Drama, ProductionCompany, DramaGenre, Genre, DramaImage, Episode])],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
  exports: [PublicCatalogService],
})
export class ContentModule {}
