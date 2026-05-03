import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { config } from './config.js';

const isProduction = config.nodeEnv === 'production';

export const logger = pino({
    level: config.logging.level,
    transport: isProduction
        ? undefined
        : {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
              },
          },
});

export const requestLogger = pinoHttp({
    logger,
    genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const reqId = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
        res.setHeader('x-request-id', reqId);
        return reqId;
    },
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} failed: ${err.message}`,
    autoLogging: {
        ignore: (req) => req.url === '/health',
    },
});
