"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadataFetched = exports.containerMetadata = exports.containerStartTime = void 0;
exports.fetchECSMetadata = fetchECSMetadata;
exports.getFormattedStartupTime = getFormattedStartupTime;
exports.getRelativeStartupTime = getRelativeStartupTime;
exports.getTaskDefinitionVersion = getTaskDefinitionVersion;
exports.getContainerMetadata = getContainerMetadata;
const luxon_1 = require("luxon");
const logger_1 = require("../logger");
// Global variable to store the app container's startup time
exports.containerStartTime = null;
// Global variable to store container metadata
exports.containerMetadata = null;
// Flag to track if metadata fetching is complete
exports.metadataFetched = false;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function fetchECSMetadata() {
    const metadataUri = process.env.ECS_CONTAINER_METADATA_URI_V4;
    // If not in ECS environment, use current time as fallback
    if (!metadataUri) {
        logger_1.logger.info('Not running in ECS environment, using current time as container start time');
        exports.containerStartTime = luxon_1.DateTime.now();
        exports.containerMetadata = {
            startTime: exports.containerStartTime.toISO() || exports.containerStartTime.toISODate() || 'unknown',
            taskDefinitionVersion: 'local-dev',
            containerName: 'app',
            taskArn: 'local-development',
            cluster: 'local',
        };
        exports.metadataFetched = true;
        return;
    }
    logger_1.logger.info('Fetching ECS metadata for container startup time', { metadataUri });
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
            const data = await response.json();
            // Find the 'app' container
            const appContainer = data.Containers.find(container => container.Name === 'app');
            if (!appContainer) {
                throw new Error('Could not find "app" container in ECS metadata');
            }
            if (appContainer.KnownStatus !== 'RUNNING') {
                throw new Error(`App container is not running yet, status: ${appContainer.KnownStatus}`);
            }
            // Parse the StartedAt timestamp and convert to luxon DateTime
            exports.containerStartTime = luxon_1.DateTime.fromISO(appContainer.StartedAt);
            if (!exports.containerStartTime.isValid) {
                throw new Error(`Invalid StartedAt timestamp: ${appContainer.StartedAt}`);
            }
            // Extract task definition version from container labels
            const taskDefinitionVersion = appContainer.Labels['com.amazonaws.ecs.task-definition-version'];
            // Store container metadata
            exports.containerMetadata = {
                startTime: appContainer.StartedAt,
                taskDefinitionVersion,
                containerName: appContainer.Name,
                taskArn: data.TaskARN,
                cluster: data.Cluster,
            };
            logger_1.logger.info('Successfully retrieved container startup time from ECS metadata', {
                startedAt: appContainer.StartedAt,
                formattedTime: exports.containerStartTime.toFormat('yyyy-MM-dd HH:mm:ss'),
                taskDefinitionVersion,
                retryCount,
            });
            exports.metadataFetched = true;
            return;
        }
        catch (error) {
            retryCount++;
            const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30 seconds
            logger_1.logger.warn('Failed to fetch ECS metadata, retrying...', {
                error: error instanceof Error ? error.message : String(error),
                retryCount,
                maxRetries,
                nextRetryIn: `${delay}ms`,
            });
            if (retryCount >= maxRetries) {
                logger_1.logger.error('Max retries reached for ECS metadata fetching, using current time as fallback', {
                    maxRetries,
                    finalError: error instanceof Error ? error.message : String(error),
                });
                // Use current time as fallback
                exports.containerStartTime = luxon_1.DateTime.now();
                exports.containerMetadata = {
                    startTime: exports.containerStartTime.toISO() || exports.containerStartTime.toISODate() || 'unknown',
                    taskDefinitionVersion: 'unknown',
                    containerName: 'app',
                    taskArn: 'unknown',
                    cluster: 'unknown',
                };
                exports.metadataFetched = true;
                return;
            }
            await sleep(delay);
        }
    }
}
// Helper function to get formatted startup time for logging
function getFormattedStartupTime() {
    return exports.containerStartTime ? exports.containerStartTime.toFormat('yyyy-MM-dd HH:mm:ss') : null;
}
// Helper function to get relative startup time for headers
function getRelativeStartupTime() {
    return exports.containerStartTime ? exports.containerStartTime.toRelative() : null;
}
// Helper function to get task definition version
function getTaskDefinitionVersion() {
    return exports.containerMetadata ? exports.containerMetadata.taskDefinitionVersion : null;
}
// Helper function to get all container metadata
function getContainerMetadata() {
    return exports.containerMetadata;
}
//# sourceMappingURL=index.js.map