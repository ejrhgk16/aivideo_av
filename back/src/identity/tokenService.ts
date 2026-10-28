import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from '../economy/entities/index.js';
import { InvalidTokenException } from '../common/error/error.customExceptions.js';
import { AuthSession, RefreshToken, User } from './entities/index.js';

const accessLifetime = 900;
const refreshLifetime = 1209600;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RefreshClaims {
  sub: string;
  jti: string;
  tokenType: 'refresh';
  iat: number;
  exp: number;
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    this.accessSecret = config.get<string>('JWT_ACCESS_SECRET')?.trim() ?? '';
    this.refreshSecret = config.get<string>('JWT_REFRESH_SECRET')?.trim() ?? '';
    if (!this.accessSecret || !this.refreshSecret || this.accessSecret === this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct non-empty values.');
    }
  }

  async generateTokens(userUuid: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userUuid, tokenType: 'access' },
        { secret: this.accessSecret, algorithm: 'HS256', expiresIn: accessLifetime },
      ),
      this.jwt.signAsync(
        { sub: userUuid, tokenType: 'refresh' },
        {
          secret: this.refreshSecret,
          algorithm: 'HS256',
          expiresIn: refreshLifetime,
          jwtid: randomUUID(),
        },
      ),
    ]);
    const claims = this.jwt.decode(refreshToken) as { exp?: number } | null;
    if (!claims || typeof claims.exp !== 'number') throw new Error('Refresh token expiration was not generated.');
    return {
      accessToken,
      refreshToken,
      refreshExpiresAt: new Date(claims.exp * 1000),
    };
  }

  async saveRefreshToken(userId: number, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sessions = manager.getRepository(AuthSession);
      const session = await sessions.save(sessions.create({ userId, revokedAt: null }));
      const tokens = manager.getRepository(RefreshToken);
      await tokens.save(tokens.create({
        authSessionId: session.id,
        tokenHash: this.hash(refreshToken),
        expiresAt,
        usedAt: null,
      }));
    });
  }

  async refresh(refreshToken: string) {
    const claims = await this.verifyRefresh(refreshToken);
    const found = await this.refreshTokens.findOneBy({ tokenHash: this.hash(refreshToken) });
    if (!found) throw new InvalidTokenException();

    const result = await this.dataSource.transaction(async (manager) => {
      const sessions = manager.getRepository(AuthSession);
      const tokens = manager.getRepository(RefreshToken);
      const session = await sessions.createQueryBuilder('session')
        .where('session.id = :id', { id: found.authSessionId })
        .setLock('pessimistic_write')
        .getOne();
      if (!session) return null;
      const stored = await tokens.createQueryBuilder('token')
        .where('token.id = :id', { id: found.id })
        .andWhere('token.authSessionId = :sessionId', { sessionId: session.id })
        .setLock('pessimistic_write')
        .getOne();
      const user = await manager.getRepository(User).findOneBy({ id: session.userId });
      if (!stored || !user || user.uuid !== claims.sub) return null;

      const now = new Date();
      if (stored.usedAt !== null) {
        session.revokedAt = now;
        session.updatedAt = now;
        await sessions.save(session);
        return null;
      }
      if (session.revokedAt !== null || user.status !== 'ACTIVE' ||
          claims.exp * 1000 <= now.getTime() || stored.expiresAt.getTime() <= now.getTime()) {
        return null;
      }

      const generated = await this.generateTokens(user.uuid);
      stored.usedAt = now;
      stored.updatedAt = now;
      await tokens.save(stored);
      await tokens.save(tokens.create({
        authSessionId: session.id,
        tokenHash: this.hash(generated.refreshToken),
        expiresAt: generated.refreshExpiresAt,
        usedAt: null,
      }));
      const wallet = await manager.getRepository(Wallet).findOneBy({ userId: user.id });
      return {
        uuid: user.uuid,
        displayName: user.displayName,
        accountType: user.accountType,
        availablePoints: wallet?.availablePoints ?? 0,
        accessToken: generated.accessToken,
        refreshToken: generated.refreshToken,
        expiresIn: accessLifetime,
      };
    });

    if (result === null) throw new InvalidTokenException();
    return result;
  }

  async logout(refreshToken: string): Promise<void> {
    const claims = await this.verifyRefresh(refreshToken);
    if (claims.exp * 1000 <= Date.now()) throw new InvalidTokenException();
    const found = await this.refreshTokens.findOneBy({ tokenHash: this.hash(refreshToken) });
    if (!found) return;

    await this.dataSource.transaction(async (manager) => {
      const sessions = manager.getRepository(AuthSession);
      const session = await sessions.createQueryBuilder('session')
        .where('session.id = :id', { id: found.authSessionId })
        .setLock('pessimistic_write')
        .getOne();
      if (!session) return;
      const stored = await manager.getRepository(RefreshToken).createQueryBuilder('token')
        .where('token.id = :id', { id: found.id })
        .andWhere('token.authSessionId = :sessionId', { sessionId: session.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!stored) return;
      const user = await manager.getRepository(User).findOneBy({ id: session.userId });
      if (!user || user.uuid !== claims.sub) throw new InvalidTokenException();
      if (session.revokedAt !== null) return;
      session.revokedAt = new Date();
      session.updatedAt = session.revokedAt;
      await sessions.save(session);
    });
  }

  private async verifyRefresh(token: string): Promise<RefreshClaims> {
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
        ignoreExpiration: true,
      });
    } catch {
      throw new InvalidTokenException();
    }
    if (!uuidPattern.test(claims.sub) || !uuidPattern.test(claims.jti) ||
        claims.tokenType !== 'refresh' || !Number.isFinite(claims.iat) ||
        !Number.isFinite(claims.exp)) {
      throw new InvalidTokenException();
    }
    return claims;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
