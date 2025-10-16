"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const logger_1 = require("./logger");
const ecs_metadata_1 = require("./ecs-metadata");
const port = 80;
async function startServer() {
    try {
        logger_1.logger.info('Starting server initialization...');
        // Fetch ECS metadata first
        await (0, ecs_metadata_1.fetchECSMetadata)();
        const containerStart = (0, ecs_metadata_1.getFormattedStartupTime)();
        logger_1.logger.info('ECS metadata fetching completed', { containerStart });
        // Start the Express server
        app_1.default.listen(port, () => {
            logger_1.logger.info('Server started successfully', {
                port: port,
                environment: process.env.NODE_ENV || 'development',
                region: process.env.AWS_REGION || 'local',
                logLevel: logger_1.logger.level,
                url: `http://localhost:${port}`,
                containerStart,
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    }
}
// Start the server
startServer();
//# sourceMappingURL=main.js.map