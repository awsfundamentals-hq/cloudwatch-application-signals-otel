import { context, trace } from '@opentelemetry/api';
import { randomBytes } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { getRelativeStartupTime, getTaskDefinitionVersion } from './ecs-metadata/index';
import { logger } from './logger';

const tracer = trace.getTracer(process.env.SERVICE_NAME!);

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { url, method } = req;
  const userAgent = req.get('User-Agent');

  const exampleSpan = tracer.startSpan('ecs-span');
  logger.info(`Example ECS Span opened`, { method, url, userAgent });
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

export const startupHeaderMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  const relativeStartupTime = getRelativeStartupTime();
  if (relativeStartupTime) {
    res.set('x-startup', relativeStartupTime);
  }

  const taskDefinitionVersion = getTaskDefinitionVersion();
  if (taskDefinitionVersion) {
    res.set('x-task-definition', taskDefinitionVersion);
  }

  next();
};

export const traceparentMiddleware = (_req: Request, res: Response, next: NextFunction) => {
  let traceparent: string;
  const span = trace.getSpan(context.active());

  const version = '00';
  let flags = '01';
  let spanId: string;
  let traceId: string;

  if (!span) {
    traceId = randomBytes(16).toString('hex');
    spanId = randomBytes(8).toString('hex');
  } else {
    traceId = span.spanContext().traceId;
    spanId = span.spanContext().spanId;
    flags = span.spanContext().traceFlags.toString();
  }

  traceparent = `${version}-${traceId}-${spanId}-${flags}`;
  res.set('traceparent', traceparent);
  res.set('trace_id', traceId);
  res.locals.traceparent = traceparent;

  next();
};
