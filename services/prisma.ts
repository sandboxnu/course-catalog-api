import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", "warn", "error"],
  });
  logger.verbose("created prisma client");
} catch (e) {
  logger.error("error creating prisma client");
  throw e;
}

export default prisma;
