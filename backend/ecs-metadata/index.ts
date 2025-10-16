import { DateTime } from 'luxon';
import { logger } from '../logger';
import { ECSTaskMetadata, ECSContainer, ContainerMetadata } from './types';

// Global variable to store the app container's startup time
export let containerStartTime: DateTime | null = null;

// Global variable to store container metadata
export let containerMetadata: ContainerMetadata | null = null;

// Flag to track if metadata fetching is complete
export let metadataFetched = false;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchECSMetadata(): Promise<void> {
  const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;

  // If not in ECS environment, use current time as fallback
  if (!metadataUri) {
    logger.info('Not running in ECS environment, using current time as container start time');
    containerStartTime = DateTime.now();
    containerMetadata = {
      startTime: containerStartTime.toISO() || containerStartTime.toISODate() || 'unknown',
      taskDefinitionVersion: 'local-dev',
      containerName: 'app',
      taskArn: 'local-development',
      cluster: 'local',
    };
    metadataFetched = true;
    return;
  }

  logger.info('Fetching ECS metadata for container startup time', { metadataUri });

  let retryCount = 0;
  const maxRetries = 30; // Maximum number of retries
  const baseDelay = 1000; // Base delay in milliseconds

  while (retryCount < maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${metadataUri}/task`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ECS metadata API returned ${response.status}: ${response.statusText}`);
      }

      const data: ECSTaskMetadata = await response.json();
      
      // Find the 'app' container
      const appContainer = data.Containers.find(container => container.Name === 'app');
      
      if (!appContainer) {
        throw new Error('Could not find "app" container in ECS metadata');
      }

      if (appContainer.KnownStatus !== 'RUNNING') {
        throw new Error(`App container is not running yet, status: ${appContainer.KnownStatus}`);
      }

      // Parse the StartedAt timestamp and convert to luxon DateTime
      containerStartTime = DateTime.fromISO(appContainer.StartedAt);
      
      if (!containerStartTime.isValid) {
        throw new Error(`Invalid StartedAt timestamp: ${appContainer.StartedAt}`);
      }

      // Extract task definition version from container labels
      const taskDefinitionVersion = appContainer.Labels['com.amazonaws.ecs.task-definition-version'];
      
      // Store container metadata
      containerMetadata = {
        startTime: appContainer.StartedAt,
        taskDefinitionVersion,
        containerName: appContainer.Name,
        taskArn: data.TaskARN,
        cluster: data.Cluster,
      };

      logger.info('Successfully retrieved container startup time from ECS metadata', {
        startedAt: appContainer.StartedAt,
        formattedTime: containerStartTime.toFormat('yyyy-MM-dd HH:mm:ss'),
        taskDefinitionVersion,
        retryCount,
      });

      metadataFetched = true;
      return;

    } catch (error) {
      retryCount++;
      const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30 seconds

      logger.warn('Failed to fetch ECS metadata, retrying...', {
        error: error instanceof Error ? error.message : String(error),
        retryCount,
        maxRetries,
        nextRetryIn: `${delay}ms`,
      });

      if (retryCount >= maxRetries) {
        logger.error('Max retries reached for ECS metadata fetching, using current time as fallback', {
          maxRetries,
          finalError: error instanceof Error ? error.message : String(error),
        });
        
        // Use current time as fallback
        containerStartTime = DateTime.now();
        containerMetadata = {
          startTime: containerStartTime.toISO() || containerStartTime.toISODate() || 'unknown',
          taskDefinitionVersion: 'unknown',
          containerName: 'app',
          taskArn: 'unknown',
          cluster: 'unknown',
        };
        metadataFetched = true;
        return;
      }

      await sleep(delay);
    }
  }
}

// Helper function to get formatted startup time for logging
export function getFormattedStartupTime(): string | null {
  return containerStartTime ? containerStartTime.toFormat('yyyy-MM-dd HH:mm:ss') : null;
}

// Helper function to get relative startup time for headers
export function getRelativeStartupTime(): string | null {
  return containerStartTime ? containerStartTime.toRelative() : null;
}

// Helper function to get task definition version
export function getTaskDefinitionVersion(): string | null {
  return containerMetadata ? containerMetadata.taskDefinitionVersion : null;
}

// Helper function to get all container metadata
export function getContainerMetadata(): ContainerMetadata | null {
  return containerMetadata;
}