import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '../economy/entities/index.js';
import { AuthSession, RefreshToken, User } from './entities/index.js';
import { JwtAuthGuard } from './jwtAuthGuard.js';
import { OptionalJwtAuthGuard } from './optionalJwtAuthGuard.js';
import { JwtStrategy } from './jwtStrategy.js';
import { LoginController } from './loginController.js';
import { LoginService } from './loginService.js';
import { TokenService } from './tokenService.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Wallet, AuthSession, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const accessSecret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
        const refreshSecret = config.get<string>('JWT_REFRESH_SECRET')?.trim();
        if (!accessSecret || !refreshSecret || accessSecret === refreshSecret) {
          throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct non-empty values.');
        }
        return { secret: accessSecret };
      },
    }),
  ],
  controllers: [LoginController],
  providers: [LoginService, TokenService, JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard, PassportModule],
})
export class IdentityModule {}
