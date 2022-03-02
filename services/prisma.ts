import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

macros.log("** Creating Prisma client");
let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", "warn", "error"],
  });
} catch (e) {
  macros.error(e);
}

export default prisma;
