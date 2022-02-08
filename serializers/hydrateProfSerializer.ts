/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { Professor as PrismaProfessor } from "@prisma/client";
import ProfSerializer from "./profSerializer";

class HydrateProfSerializer extends ProfSerializer<PrismaProfessor> {
  _serializeProf(prof: PrismaProfessor): PrismaProfessor {
    return prof;
  }
}

export default HydrateProfSerializer;
