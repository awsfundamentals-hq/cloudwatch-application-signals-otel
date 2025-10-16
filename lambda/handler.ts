import { trace } from '@opentelemetry/api';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const tracer = trace.getTracer(process.env.AWS_LAMBDA_FUNCTION_NAME!);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const exampleSpan = tracer.startSpan('lambda-span');

  console.log(`Incoming request`);

  exampleSpan.end();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Hello from Lambda!',
    }),
  };
};
