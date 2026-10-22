import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Drama } from '../content/entities/drama.entity.js';
import { DramaGenre } from '../content/entities/dramaGenre.entity.js';
import { ContentImage } from '../content/entities/contentImage.entity.js';
import { ContentVideo } from '../content/entities/contentVideo.entity.js';
import { Episode } from '../content/entities/episode.entity.js';
import { Genre } from '../content/entities/genre.entity.js';
import { ProductionCompany } from '../content/entities/productionCompany.entity.js';
import { CollectionDrama } from './entities/collectionDrama.entity.js';
import { ContentCollection } from './entities/contentCollection.entity.js';
import { PublicCollectionController } from './publicCollectionController.js';
import { PublicCollectionService } from './publicCollectionService.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentCollection,
      CollectionDrama,
      Drama,
      ProductionCompany,
      DramaGenre,
      Genre,
      ContentImage,
      ContentVideo,
      Episode,
    ]),
  ],
  controllers: [PublicCollectionController],
  providers: [PublicCollectionService],
})
export class ProgrammingModule {}
