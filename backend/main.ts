import app from './app';
import { logger } from './logger';

const port = 80;

app.listen(port, () => {
  logger.info('Server started successfully', {
    port: port,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'local',
    logLevel: logger.level,
    url: `http://localhost:${port}`,
  });
});
