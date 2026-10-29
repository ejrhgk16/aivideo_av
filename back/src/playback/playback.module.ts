import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drama, Episode, ContentVideo } from '../content/entities/index.js';
import { EpisodeEntitlement } from '../economy/entities/index.js';
import { User } from '../identity/entities/index.js';
import { IdentityModule } from '../identity/identity.module.js';
import { WatchProgressController } from './watchProgressController.js';
import { WatchProgressService } from './watchProgressService.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([Drama, Episode, ContentVideo, EpisodeEntitlement, User]),
  ],
  controllers: [WatchProgressController],
  providers: [WatchProgressService],
})
export class PlaybackModule {}
