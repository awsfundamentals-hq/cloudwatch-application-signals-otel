import { context, trace } from '@opentelemetry/api';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomBytes } from 'crypto';

const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME!);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const exampleSpan = tracer.startSpan('lambda-span');

  console.log(`Incoming request`);

  exampleSpan.end();

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

  const traceparent = `${version}-${traceId}-${spanId}-${flags}`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'traceparent': traceparent,
      'trace_id': traceId,
    },
    body: JSON.stringify({
      message: 'Hello from Lambda!',
    }),
  };
};
