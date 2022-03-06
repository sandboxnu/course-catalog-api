import { Prisma, PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

macros.log("** Creating Prisma client");
let prisma: any;
try {
  let prisma = new PrismaClient({
    log: ["info", { level: "error", emit: "event" }, "warn", "error"],
  });

  // TEMP / TODO - REMOVE / DO NOT LEAVE HERE PLEASE
  // Temp fix to address Prisma connection pool issues
  // https://github.com/prisma/prisma/issues/7249#issuecomment-1059719644
  prisma.$on("error", (e: Prisma.LogEvent) => {
    macros.error(e);
    macros.log("Prisma - handling error");
    macros.log(e.message);
    if (e.message.includes("Timed out fetching a new connection")) {
      prisma.$disconnect;
    }
  });
} catch (e) {
  macros.error(e);
}

export default prisma as PrismaClient;
