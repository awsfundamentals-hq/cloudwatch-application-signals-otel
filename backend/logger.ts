import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    service: process.env.SERVICE_NAME!,
    environment: process.env.STAGE!,
    region: process.env.AWS_REGION || 'local',
  },
  transports: [new winston.transports.Console()],
});
