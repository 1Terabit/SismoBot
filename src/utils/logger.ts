type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",  // gray
  info: "\x1b[36m",   // cyan
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
};

const RESET = "\x1b[0m";

class Logger {
  private minLevel: LogLevel;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
    this.minLevel = LEVEL_PRIORITY[envLevel] !== undefined ? envLevel : "info";
  }

  private log(level: LogLevel, context: string, message: string, data?: unknown): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const prefix = `${color}[${timestamp}] [${level.toUpperCase()}] [${context}]${RESET}`;

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  debug(context: string, message: string, data?: unknown): void {
    this.log("debug", context, message, data);
  }

  info(context: string, message: string, data?: unknown): void {
    this.log("info", context, message, data);
  }

  warn(context: string, message: string, data?: unknown): void {
    this.log("warn", context, message, data);
  }

  error(context: string, message: string, data?: unknown): void {
    this.log("error", context, message, data);
  }
}

export const logger = new Logger();
