"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceparentMiddleware = exports.startupHeaderMiddleware = exports.requestLoggingMiddleware = void 0;
const opentelemetry = __importStar(require("@opentelemetry/api"));
const logger_1 = require("./logger");
const index_1 = require("./ecs-metadata/index");
const crypto_1 = require("crypto");
const tracer = opentelemetry.trace.getTracer(process.env.SERVICE_NAME);
const requestLoggingMiddleware = (req, res, next) => {
    const exampleSpan = tracer.startSpan('ecs-span');
    logger_1.logger.info(`Example ECS Span opened`);
    const start = Date.now();
    const { url, method } = req;
    const userAgent = req.get('User-Agent');
    logger_1.logger.info('Incoming request', { method, url, userAgent });
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = `${Date.now() - start}ms`;
        const { statusCode } = res;
        logger_1.logger.info('Request completed', { method, url, statusCode, duration });
        exampleSpan.end();
        return originalEnd(chunk, encoding, cb);
    };
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
const startupHeaderMiddleware = (req, res, next) => {
    const relativeStartupTime = (0, index_1.getRelativeStartupTime)();
    if (relativeStartupTime) {
        res.set('x-startup', relativeStartupTime);
    }
    const taskDefinitionVersion = (0, index_1.getTaskDefinitionVersion)();
    if (taskDefinitionVersion) {
        res.set('x-task-definition', taskDefinitionVersion);
    }
    next();
};
exports.startupHeaderMiddleware = startupHeaderMiddleware;
const traceparentMiddleware = (req, res, next) => {
    let traceparent = req.get('traceparent');
    if (!traceparent) {
        const version = '00';
        const traceId = (0, crypto_1.randomBytes)(16).toString('hex');
        const spanId = (0, crypto_1.randomBytes)(8).toString('hex');
        const flags = '01';
        traceparent = `${version}-${traceId}-${spanId}-${flags}`;
        logger_1.logger.info('Generated new traceparent header', { traceparent });
    }
    else {
        const parts = traceparent.split('-');
        if (parts.length === 4) {
            const [version, traceId, , flags] = parts;
            const newSpanId = (0, crypto_1.randomBytes)(8).toString('hex');
            traceparent = `${version}-${traceId}-${newSpanId}-${flags}`;
            logger_1.logger.info('Updated traceparent with new span ID', { traceparent });
        }
    }
    res.set('traceparent', traceparent);
    res.locals.traceparent = traceparent;
    next();
};
exports.traceparentMiddleware = traceparentMiddleware;
//# sourceMappingURL=middlewares.js.map