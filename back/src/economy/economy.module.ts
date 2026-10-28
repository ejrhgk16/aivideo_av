import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drama, Episode } from '../content/entities/index.js';
import { User } from '../identity/entities/index.js';
import { IdentityModule } from '../identity/identity.module.js';
import { EpisodeEntitlement, PointTransaction, Wallet } from './entities/index.js';
import { PointController } from './pointController.js';
import { PointService } from './pointService.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([
      User,
      Wallet,
      PointTransaction,
      Episode,
      Drama,
      EpisodeEntitlement,
    ]),
  ],
  controllers: [PointController],
  providers: [PointService],
})
export class EconomyModule {}
