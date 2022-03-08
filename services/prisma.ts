import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", "warn", "error"],
  });
  macros.log("** Created Prisma client");

  // TEMP / TODO - REMOVE / DO NOT LEAVE HERE PLEASE
  // Temp fix to address Prisma connection pool issues
  // https://github.com/prisma/prisma/issues/7249#issuecomment-1059719644
  const intervalTime = 6 * 60 * 60_000; // Every 6 hours
  setInterval(async () => {
    const startTime = Date.now();
    await prisma.$disconnect();
    macros.log("Disconnected Prisma");
    await prisma.$connect();
    const totalTime = Date.now() - startTime;
    macros.log(
      `Reconnected Prisma - downtime of ${totalTime} ms (${
        totalTime / 60_000
      } mins)`
    );
  }, intervalTime);
} catch (e) {
  macros.error(e);
}

export default prisma;
