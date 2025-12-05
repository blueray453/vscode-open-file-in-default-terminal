const winston = require('winston');
const os = require('os');
const path = require('path');

let logger; // module-level singleton

function createLogger() {
    if (logger) return logger; // return existing instance if already created

    const logFile = path.join(os.homedir(), 'cli-runner.log');

    logger = winston.createLogger({
        level: 'info',
        format: winston.format.printf(({ level, message }) => `[${level}] ${message}`),
        transports: [
            new winston.transports.File({ filename: logFile })
        ]
    });

    logger.info('Logger initialized: ' + logFile);
    return logger;
}

module.exports = { createLogger };
