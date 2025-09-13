"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const logger_1 = require("./logger");
const port = 80;
app_1.default.listen(port, () => {
    logger_1.logger.info('Server started successfully', {
        port: port,
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'local',
        logLevel: logger_1.logger.level,
        url: `http://localhost:${port}`,
    });
});
//# sourceMappingURL=main.js.map