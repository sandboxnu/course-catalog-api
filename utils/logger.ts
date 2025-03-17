import { createLogger, format, Logger, transports } from "winston";

const logger = createLogger({
  // Stick with debug in prod FOR NOW
  level: "debug",
  format: format.json(),
  defaultMeta: { service: "user-service" },
  transports: [
    new transports.Console({
      format: format.simple(),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.configure({
    level: "debug",
  });
}

export default logger;
