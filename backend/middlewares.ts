// import * as opentelemetry from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { logger } from './logger';


// const tracer = opentelemetry.trace.getTracer(process.env.SERVICE_NAME!);

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // const exampleSpan = tracer.startSpan('ecs-span');

  // console.log(JSON.stringify(req, null, 2));

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
    // exampleSpan.end();
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
};
