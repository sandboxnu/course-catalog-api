/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import ProfSerializer from "./profSerializer";
import { Professor as PrismaProfessor } from "@prisma/client";
import { ESProfessor } from "../types/serializerTypes";

class ElasticProfSerializer extends ProfSerializer<ESProfessor> {
  _serializeProf(prof: PrismaProfessor): ESProfessor {
    const keys = ["id", "name", "email", "phone"];
    return Object.keys(prof).reduce((acc, key) => {
      if (keys.includes(key)) {
        acc[key] = prof[key];
      }
      return acc;
    }, {} as ESProfessor);
  }
}

export default ElasticProfSerializer;
