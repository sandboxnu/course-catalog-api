import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", "warn", "error"],
  });
} catch (e) {
  // See github pull #91 for more info
  // Basically, we need to be able to kill Prisma in our Macros class
  // So, we can't use Macros in this file, since this file is a dependency for Macros, and that creates a circular dependency
  console.error(e);
}

export default prisma;
