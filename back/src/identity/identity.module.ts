import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '../economy/entities/index.js';
import { User } from './entities/index.js';
import { LoginController } from './loginController.js';
import { LoginService } from './loginService.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Wallet])],
  controllers: [LoginController],
  providers: [LoginService],
})
export class IdentityModule {}
