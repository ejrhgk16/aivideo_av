import { DataSource } from 'typeorm';

import {
  createDatabaseOptions,
  loadDatabaseEnvironment,
} from './databaseConfig.js';

loadDatabaseEnvironment();

const dataSource = new DataSource(createDatabaseOptions());

export default dataSource;
