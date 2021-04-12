import { PrismaClient } from "@prisma/client";
import macros from "../utils/macros";

let prisma;
try {
  prisma = new PrismaClient();
} catch (e) {
  macros.error(e);
}

export default prisma;
