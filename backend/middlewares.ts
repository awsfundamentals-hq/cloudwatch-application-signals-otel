import * as opentelemetry from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import { getRelativeStartupTime } from './ecs-metadata';
import { randomBytes } from 'crypto';

const tracer = opentelemetry.trace.getTracer(process.env.SERVICE_NAME!);

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const exampleSpan = tracer.startSpan('ecs-span');

  logger.info(`Example ECS Span opened`);

  const start = Date.now();
  const { url, method } = req;
  const userAgent = req.get('User-Agent');

  logger.info('Incoming request', { method, url, userAgent });

  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const duration = `${Date.now() - start}ms`;
    const { statusCode } = res;
    logger.info('Request completed', { method, url, statusCode, duration });
    exampleSpan.end();
    return originalEnd(chunk, encoding as BufferEncoding, cb);
  };

  next();
};

export const startupHeaderMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const relativeStartupTime = getRelativeStartupTime();
  if (relativeStartupTime) {
    res.set('x-startup', relativeStartupTime);
  }
  next();
};

export const traceparentMiddleware = (req: Request, res: Response, next: NextFunction) => {
  let traceparent = req.get('traceparent');
  
  if (!traceparent) {
    const version = '00';
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');
    const flags = '01';
    
    traceparent = `${version}-${traceId}-${spanId}-${flags}`;
    logger.info('Generated new traceparent header', { traceparent });
  } else {
    const parts = traceparent.split('-');
    if (parts.length === 4) {
      const [version, traceId, , flags] = parts;
      const newSpanId = randomBytes(8).toString('hex');
      traceparent = `${version}-${traceId}-${newSpanId}-${flags}`;
      logger.info('Updated traceparent with new span ID', { traceparent });
    }
  }
  
  res.set('traceparent', traceparent);
  res.locals.traceparent = traceparent;
  
  next();
};
