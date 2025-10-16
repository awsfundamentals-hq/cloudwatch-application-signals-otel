import winston from 'winston';
import { getFormattedStartupTime } from './ecs-metadata';

// Custom format to add container start time dynamically
const addContainerStartTime = winston.format((info) => {
  const containerStart = getFormattedStartupTime();
  if (containerStart) {
    info.containerStart = containerStart;
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addContainerStartTime(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME!,
    environment: process.env.STAGE!,
    region: process.env.AWS_REGION || 'local',
  },
  transports: [new winston.transports.Console()],
});
