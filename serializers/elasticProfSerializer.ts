/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import ProfSerializer from "./profSerializer";
import { Professor as PrismaProfessor } from "@prisma/client";
import { ESProfessor } from "../types/serializerTypes";

class ElasticProfSerializer extends ProfSerializer<ESProfessor> {
  override _serializeProf(prof: PrismaProfessor): ESProfessor {
    return {
      id: prof["id"],
      name: prof["name"],
      email: prof["email"],
      phone: prof["phone"],
    };
  }
}

export default ElasticProfSerializer;
