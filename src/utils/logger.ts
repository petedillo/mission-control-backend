// Logger utility with Pino for structured JSON logging

import pino, { type Logger as PinoLogger } from 'pino';

// Keep LogLevel enum for compatibility
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.SILENT,
};

const levelToPino: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.SILENT]: 'silent',
};

const pinoToLevel: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.SILENT,
};

/**
 * Logger wrapper class maintaining API compatibility
 */
export class Logger {
  private pino: PinoLogger;

  constructor(level?: LogLevel, _timestamps?: boolean, prefix?: string) {
    const pinoLevel = level !== undefined ? levelToPino[level] : getLogLevel();

    this.pino = pino({
      level: pinoLevel,
      name: prefix || 'mission-control',
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      } : undefined,
    });
  }

  /**
   * Log debug-level message (dev-only verbose logging)
   */
  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.debug({ args }, message);
    } else {
      this.pino.debug(message);
    }
  }

  /**
   * Log info-level message (operational status)
   */
  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.info({ args }, message);
    } else {
      this.pino.info(message);
    }
  }

  /**
   * Log warning-level message (non-fatal issues)
   */
  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.warn({ args }, message);
    } else {
      this.pino.warn(message);
    }
  }

  /**
   * Log error-level message (errors and failures)
   */
  error(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.pino.error({ args }, message);
    } else {
      this.pino.error(message);
    }
  }

  /**
   * Print raw, unformatted output (for banners, etc.)
   * Always prints regardless of log level
   */
  raw(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  /**
   * Create a child logger with an additional prefix
   */
  child(prefix: string): Logger {
    const child = new Logger();
    child.pino = this.pino.child({ name: prefix });
    return child;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    const currentLevel = this.pino.level;
    return pinoToLevel[currentLevel] ?? LogLevel.INFO;
  }
}

/**
 * Parse log level from environment variable
 */
function parseLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();

  if (envLevel && envLevel in LOG_LEVEL_MAP) {
    return LOG_LEVEL_MAP[envLevel]!;
  }

  // Default based on NODE_ENV
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? LogLevel.INFO : LogLevel.DEBUG;
}

/**
 * Get Pino log level string
 */
function getLogLevel(): string {
  const level = parseLogLevel();
  return levelToPino[level]!;
}

// Singleton logger instance
export const logger = new Logger(parseLogLevel());

export default logger;
