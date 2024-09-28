/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import ProfSerializer from "./profSerializer";
import { Professor as PrismaProfessor } from "@prisma/client";

class HydrateProfSerializer extends ProfSerializer<PrismaProfessor> {
  static _serializeProf(prof: PrismaProfessor): PrismaProfessor {
    return prof;
  }
}

export default HydrateProfSerializer;
