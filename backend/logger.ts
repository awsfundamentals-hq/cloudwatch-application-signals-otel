import winston from 'winston';
import { getFormattedStartupTime, getTaskDefinitionVersion } from './ecs-metadata/index';

// Custom format to add container start time dynamically
const addContainerMetadata = winston.format((info) => {
  const containerStart = getFormattedStartupTime();
  const taskDefinitionVersion = getTaskDefinitionVersion();
  if (containerStart) {
    info.containerStart = containerStart;
  }
  if (taskDefinitionVersion) {
    info.taskDefinition = taskDefinitionVersion;
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    addContainerMetadata(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.OTEL_SERVICE_NAME!,
    environment: process.env.STAGE!,
    region: process.env.AWS_REGION || 'local',
  },
  transports: [new winston.transports.Console()],
});
