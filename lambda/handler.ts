import * as opentelemetry from '@opentelemetry/api';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const tracer = opentelemetry.trace.getTracer(process.env.AWS_LAMBDA_FUNCTION_NAME as string);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const exampleSpan = tracer.startSpan('exampleSpan');

  console.log(JSON.stringify(event, null, 2));

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
