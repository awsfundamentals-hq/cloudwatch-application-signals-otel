"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./logger");
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    logger_1.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        requestId: req.get('X-Request-ID') || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        logger_1.logger.info('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
        });
        return originalEnd(chunk, encoding, cb);
    };
    next();
});
// Health endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
// Catch-all route
app.use('*', (req, res) => {
    res.json({ message: 'Hello from Fargate! 🏗️' });
});
exports.default = app;
//# sourceMappingURL=app.js.map