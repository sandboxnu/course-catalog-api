import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

macros.log("** Creating Prisma client");
let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    // Prisma doesn't allow string interpolation - https://github.com/prisma/prisma/issues/2559
    // We set additional variables here
    datasources: {
      db: { url: `${process.env.DATABASE_URL}?connection_limit=15` },
    },
  });
} catch (e) {
  macros.error(e);
}

export default prisma;
