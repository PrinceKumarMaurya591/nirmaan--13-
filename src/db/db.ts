import { drizzle } from "drizzle-orm/postgres-js";
import postgres from 'postgres';
import * as schema from './schema.ts';

export const createPool = () => {
  const dbUrl = process.env.DATABASE_URL || process.env.Database_URL;
  if (dbUrl) {
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    return postgres(dbUrl, {
      max: 10,
      ssl: isLocal ? false : 'require',
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  
  return postgres({
    host: process.env.SQL_HOST || process.env.host,
    user: process.env.SQL_USER || process.env.user,
    password: process.env.SQL_PASSWORD || process.env.password,
    database: process.env.SQL_DB_NAME || process.env.database,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
};

const client = createPool();

export const db = drizzle(client, { schema });
