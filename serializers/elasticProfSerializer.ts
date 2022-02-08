/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import { Professor as PrismaProfessor } from "@prisma/client";
import ProfSerializer from "./profSerializer";
import { ESProfessor } from "../types/serializerTypes";

class ElasticProfSerializer extends ProfSerializer<ESProfessor> {
  _serializeProf(prof: PrismaProfessor): ESProfessor {
    return _.pick(prof, ["name", "emails", "phone"]);
  }
}

export default ElasticProfSerializer;
