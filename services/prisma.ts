import { Prisma, PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

let prisma: PrismaClient;
try {
  prisma = new PrismaClient({
    log: ["info", { level: "error", emit: "event" }, "warn", "error"],
  });
  macros.log("** Created new Prisma client");
  // TEMP / TODO - REMOVE / DO NOT LEAVE HERE PLEASE
  // Temp fix to address Prisma connection pool issues
  // https://github.com/prisma/prisma/issues/7249#issuecomment-1059719644
  // @ts-expect-error - since we define the type before providing the options, the PrismaClient type is incompelete here
  prisma.$on("error", (e: Prisma.LogEvent) => {
    macros.error(e);
    macros.log("Prisma - handling error");
    macros.log(e.message);
    if (e.message.includes("Timed out fetching a new connection")) {
      prisma
        .$disconnect()
        .then(() => macros.log("Disconnected from Prisma pool"))
        .catch((e) => macros.error(e));
    }
  });
} catch (e) {
  macros.error(e);
}

export default prisma as PrismaClient;
