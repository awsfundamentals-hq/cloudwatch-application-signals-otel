require('./otel');

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    service: 'ecs-fargate-backend',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'local',
  },
  transports: [new winston.transports.Console()],
});

const app = express();
const port = 80;

app.use(cors());

app.use((req, res, next) => {
  const start = Date.now();

  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    requestId: req.get('X-Request-ID') || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    originalEnd.apply(res, args);
  };

  next();
});

const fetchMetadata = async () => {
  try {
    const response = await axios.get(process.env.ECS_CONTAINER_METADATA_URI);
    return response.data;
  } catch (error) {
    logger.error('Error fetching ECS metadata', {
      error: error.message,
      stack: error.stack,
      metadataUri: process.env.ECS_CONTAINER_METADATA_URI,
    });
    return null;
  }
};

app.get('/', async (req, res) => {
  try {
    if (process.env.AWS_REGION) {
      logger.info('Processing Fargate request', {
        region: process.env.AWS_REGION,
        hasMetadataUri: !!process.env.ECS_CONTAINER_METADATA_URI,
      });

      const metadata = await fetchMetadata();
      const response = {
        message: 'Hello World from Fargate! 🏗️',
        metadata,
      };

      logger.info('Fargate response prepared', {
        hasMetadata: !!metadata,
        metadataKeys: metadata ? Object.keys(metadata) : [],
      });

      res.json(response);
    } else {
      logger.info('Processing local development request');
      const response = {
        message: 'Hello World from Local! 🏠',
      };
      res.json(response);
    }
  } catch (error) {
    logger.error('Error processing root request', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  logger.info('Server started successfully', {
    port: port,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'local',
    logLevel: logger.level,
    url: `http://localhost:${port}`,
  });
});
