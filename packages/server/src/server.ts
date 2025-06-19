import app from './app';

import {
  Env,
  createLogger,
  DB,
  UserRepository,
  logStartupInfo,
} from '@aiostreams/core';

const logger = createLogger('server');

async function initialiseDatabase() {
  try {
    await DB.getInstance().initialise(Env.DATABASE_URI, []);
    logger.info('Database initialised');
  } catch (error) {
    logger.error('Failed to initialise database:', error);
    throw error;
  }
}

async function startAutoPrune() {
  try {
    await UserRepository.pruneUsers(Env.PRUNE_MAX_DAYS);
  } catch {}
  setTimeout(startAutoPrune, Env.PRUNE_INTERVAL * 1000);
}

async function start() {
  try {
    // Listen immediately so Fly.io sees the port open right away
    const port = Number(process.env.PORT) || Number(Env.PORT) || 3000;
    app.listen(port, '0.0.0.0', () => {
      logger.info(\`Server running on http://0.0.0.0:\${port}\`);
    });

    // After that, initialize the database and background tasks
    await initialiseDatabase();
    startAutoPrune();
    logStartupInfo();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await DB.getInstance().close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await DB.getInstance().close();
  process.exit(0);
});

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
