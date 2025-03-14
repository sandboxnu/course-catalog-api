import { createLogger, format, Logger, transports } from "winston";

const logger = createLogger({
  level: "info",
  format: format.json(),
  defaultMeta: { service: "user-service" },
});

if (process.env.NODE_ENV !== "production") {
  logger.configure({
    level: "debug",
    transports: [
      new transports.Console({
        format: format.simple(),
      }),
    ],
  });
}

export default logger;
