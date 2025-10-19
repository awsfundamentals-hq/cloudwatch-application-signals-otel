import { trace } from '@opentelemetry/api';

export const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME!);
