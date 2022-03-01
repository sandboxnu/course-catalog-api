import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", "warn", "error"],
  });
  macros.log("** Created new Prisma client");
} catch (e) {
  macros.error(e);
}

export default prisma;
