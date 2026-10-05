import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';

import { aiDramaEntities } from './entities.js';

const supportedNodeEnvironments = ['development', 'test', 'production'] as const;

export type DatabaseEnvironment = NodeJS.ProcessEnv;

export function getDatabaseEnvFilePaths(
  nodeEnv = process.env.NODE_ENV ?? 'development',
): string[] {
  return [`.env.${nodeEnv}`, '.env'];
}

export function loadDatabaseEnvironment(): DatabaseEnvironment {
  for (const envFilePath of getDatabaseEnvFilePaths()) {
    const absolutePath = resolve(process.cwd(), envFilePath);

    if (existsSync(absolutePath)) {
      process.loadEnvFile(absolutePath);
    }
  }

  return process.env;
}

function parseSynchronize(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  throw new Error('DB_SYNCHRONIZE must be either "true" or "false".');
}

export function createDatabaseOptions(
  env: DatabaseEnvironment = process.env,
): DataSourceOptions {
  const nodeEnv = env.NODE_ENV ?? 'development';

  if (!supportedNodeEnvironments.includes(nodeEnv as (typeof supportedNodeEnvironments)[number])) {
    throw new Error(
      `NODE_ENV must be one of ${supportedNodeEnvironments.join(', ')}.`,
    );
  }

  const synchronize = parseSynchronize(
    env.DB_SYNCHRONIZE,
    nodeEnv === 'development',
  );

  if (synchronize && nodeEnv !== 'development') {
    throw new Error(
      `DB_SYNCHRONIZE=true is only allowed in development (NODE_ENV=${nodeEnv}).`,
    );
  }

  return {
    type: 'mysql',
    host: env.DB_HOST ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? '3306'),
    username: env.DB_USERNAME ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_DATABASE ?? 'aivideodb',
    synchronize,
    migrationsRun: false,
    entities: aiDramaEntities,
    migrations: [fileURLToPath(new URL('./migrations/*.js', import.meta.url))],
    charset: 'utf8mb4',
    timezone: 'Z',
  };
}
