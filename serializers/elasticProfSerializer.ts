/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import ProfSerializer from "./profSerializer.js";
import { Professor as PrismaProfessor } from "@prisma/client";
import { ESProfessor } from "../types/serializerTypes.js";

class ElasticProfSerializer extends ProfSerializer<ESProfessor> {
  _serializeProf(prof: PrismaProfessor): ESProfessor {
    return _.pick(prof, ["id", "name", "email", "phone"]);
  }
}

export default ElasticProfSerializer;
