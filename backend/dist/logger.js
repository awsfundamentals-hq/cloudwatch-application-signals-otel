"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: {
        service: process.env.OTEL_SERVICE_NAME || 'awsfundamentals',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'local',
    },
    transports: [new winston_1.default.transports.Console()],
});
//# sourceMappingURL=logger.js.map