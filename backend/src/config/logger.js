import { createLogger, format, transports } from "winston";

const isProduction = process.env.NODE_ENV === "production";

const redactSecrets = format((info) => {
  if (typeof info.message === "string") {
    const secrets = [process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET].filter(
      (value) => typeof value === "string" && value.length > 0,
    );

    info.message = secrets.reduce(
      (message, secret) => message.replaceAll(secret, "[redacted]"),
      info.message,
    );
  }

  return info;
});

const consoleFormat = format.printf(({ level, message, timestamp, stack, ...meta }) => {
  const details = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} ${level}: ${stack || message}${details}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  format: format.combine(
    format.errors({ stack: true }),
    redactSecrets(),
    format.timestamp(),
    format.splat(),
    format.json(),
  ),
  defaultMeta: {
    service: "convox-backend",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    new transports.Console({
      format: isProduction
        ? format.combine(format.timestamp(), format.errors({ stack: true }), consoleFormat)
        : format.combine(format.colorize(), format.timestamp(), format.errors({ stack: true }), consoleFormat),
    }),
  ],
});

export default logger;
