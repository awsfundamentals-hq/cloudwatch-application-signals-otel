import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
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
};