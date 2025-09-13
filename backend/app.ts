import cors from 'cors';
import express from 'express';
import { logger } from './logger';
import { requestLoggingMiddleware } from './middlewares';

const app = express();

app.use(cors());

app.use(requestLoggingMiddleware);

app.get('/health', (_req, res) => res.status(200).send('OK'));

app.get('/echo', async (_req, res) => {
  try {
    const response = await fetch('https://postman-echo.com/get', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Postman Echo API returned ${response.status}`);
    }

    const data = await response.json();

    logger.info('Echo request completed', {
      postmanEchoResponse: data,
    });

    res.json({
      message: 'Echo from Postman Echo API',
      postmanEchoResponse: data,
    });
  } catch (error) {
    logger.error('Error in /echo route', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'Failed to call Postman Echo API',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/lambda', async (_req, res) => {
  try {
    const lambdaFunctionUrl = process.env.LAMBDA_FUNCTION_URL;

    if (!lambdaFunctionUrl) {
      logger.error('LAMBDA_FUNCTION_URL environment variable not set');
      return res.status(500).json({
        error: 'Lambda function URL not configured',
        message: 'LAMBDA_FUNCTION_URL environment variable is not set',
      });
    }

    logger.info('Calling Lambda function', { lambdaFunctionUrl });

    const response = await fetch(lambdaFunctionUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Lambda function returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    logger.info('Lambda function call completed', {
      statusCode: response.status,
      responseSize: JSON.stringify(data).length,
    });

    res.json(data);
  } catch (error) {
    logger.error('Error in /lambda route', {
      error: error instanceof Error ? error.message : String(error),
      lambdaFunctionUrl: process.env.LAMBDA_FUNCTION_URL || 'not-set',
    });
    res.status(500).json({
      error: 'Failed to call Lambda function',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.use('*', (_req, res) => res.json({ message: 'Hello from Fargate! 🏗️' }));

export default app;
