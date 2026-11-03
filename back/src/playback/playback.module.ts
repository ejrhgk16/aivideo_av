import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drama, Episode, ContentVideo } from '../content/entities/index.js';
import { EpisodeEntitlement } from '../economy/entities/index.js';
import { User } from '../identity/entities/index.js';
import { IdentityModule } from '../identity/identity.module.js';
import { WatchProgressController } from './watchProgressController.js';
import { WatchProgressService } from './watchProgressService.js';
import { SavedVideoController } from './savedVideoController.js';
import { SavedVideoService } from './savedVideoService.js';
import { WatchHistoryController } from './watchHistoryController.js';
import { WatchHistoryService } from './watchHistoryService.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([Drama, Episode, ContentVideo, EpisodeEntitlement, User]),
  ],
  controllers: [WatchProgressController, SavedVideoController, WatchHistoryController],
  providers: [WatchProgressService, SavedVideoService, WatchHistoryService],
})
export class PlaybackModule {}
