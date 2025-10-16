import app from './app';
import { logger } from './logger';
import { fetchECSMetadata, getFormattedStartupTime } from './ecs-metadata';

const port = 80;

async function startServer() {
  try {
    logger.info('Starting server initialization...');
    
    // Fetch ECS metadata first
    await fetchECSMetadata();
    
    const containerStart = getFormattedStartupTime();
    logger.info('ECS metadata fetching completed', { containerStart });
    
    // Start the Express server
    app.listen(port, () => {
      logger.info('Server started successfully', {
        port: port,
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'local',
        logLevel: logger.level,
        url: `http://localhost:${port}`,
        containerStart,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the server
startServer();
