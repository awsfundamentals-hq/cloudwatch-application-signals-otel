"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const index_1 = require("./ecs-metadata/index");
// Custom format to add container start time dynamically
const addContainerStartTime = winston_1.default.format((info) => {
    const containerStart = (0, index_1.getFormattedStartupTime)();
    if (containerStart) {
        info.containerStart = containerStart;
    }
    return info;
});
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), addContainerStartTime(), winston_1.default.format.json()),
    defaultMeta: {
        service: process.env.SERVICE_NAME,
        environment: process.env.STAGE,
        region: process.env.AWS_REGION || 'local',
    },
    transports: [new winston_1.default.transports.Console()],
});
//# sourceMappingURL=logger.js.map