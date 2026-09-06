import 'dotenv/config';
import { checkDatabaseConnection, closeDatabasePool } from './db/pool.js';

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  await checkDatabaseConnection();

  console.log(`Database connection OK. Backend ready on port ${port}.`);
  console.log('HTTP routes will be added in the authentication phase.');
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; closing database pool.`);
  await closeDatabasePool();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error) => {
  console.error('Backend startup failed:', error);
  await closeDatabasePool();
  process.exitCode = 1;
});
