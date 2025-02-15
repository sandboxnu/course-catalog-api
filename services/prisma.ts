import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

const prisma = new PrismaClient({
  log: ["info", "warn", "error"],
});
macros.log("** Created new Prisma client");

export default prisma;
