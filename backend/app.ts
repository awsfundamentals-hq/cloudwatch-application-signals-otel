import cors from 'cors';
import express from 'express';
import { logger } from './logger';

const app = express();

app.use(cors());

app.use((req, res, next) => {
  const start = Date.now();

  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
  });

  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
});

app.get('/health', (_req, res) => res.status(200).send('OK'));

app.use('*', (_req, res) => res.json({ message: 'Hello from Fargate! 🏗️' }));

export default app;
