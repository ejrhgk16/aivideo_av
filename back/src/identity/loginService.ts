import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../economy/entities/index.js';
import { LoginFailedException } from '../common/error/error.customExceptions.js';
import { User } from './entities/index.js';

export interface LoginInput {
  loginId: string;
  password: string;
}

@Injectable()
export class LoginService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async login(input: LoginInput) {
    const row = await this.users
      .createQueryBuilder('user')
      .leftJoin(Wallet, 'wallet', 'wallet.userId = user.id')
      .select('user.uuid', 'uuid')
      .addSelect('user.displayName', 'displayName')
      .addSelect('user.accountType', 'accountType')
      .addSelect('wallet.availablePoints', 'availablePoints')
      .where('user.loginId = :loginId', { loginId: input.loginId })
      .andWhere('CAST(user.password AS BINARY) = CAST(:password AS BINARY)', {
        password: input.password,
      })
      .andWhere('user.status = :status', { status: 'ACTIVE' })
      .getRawOne<{
        uuid: string;
        displayName: string | null;
        accountType: string;
        availablePoints: number | null;
      }>();

    if (!row) {
      throw new LoginFailedException();
    }

    return {
      uuid: row.uuid,
      displayName: row.displayName,
      accountType: row.accountType,
      availablePoints: row.availablePoints ?? 0,
    };
  }
}
