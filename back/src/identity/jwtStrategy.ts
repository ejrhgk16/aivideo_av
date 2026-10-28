import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { InvalidTokenException } from '../common/error/error.customExceptions.js';
import { User } from './entities/index.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
    const refreshSecret = config.get<string>('JWT_REFRESH_SECRET')?.trim();
    if (!secret || !refreshSecret || secret === refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct non-empty values.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub?: unknown; tokenType?: unknown; exp?: unknown }) {
    if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub) ||
        payload.tokenType !== 'access' || typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp)) {
      throw new InvalidTokenException();
    }
    const user = await this.users.findOneBy({ uuid: payload.sub, status: 'ACTIVE' });
    if (!user) throw new InvalidTokenException();
    return { uuid: user.uuid };
  }
}
