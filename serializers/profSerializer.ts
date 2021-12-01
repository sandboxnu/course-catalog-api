/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import {Professor as PrismaProfessor} from "@prisma/client";
import {SerializedProfessor} from "../types/serializerTypes";

class ProfSerializer<T extends Partial<PrismaProfessor>> {
  async bulkSerialize(instances: PrismaProfessor[]): Promise<Record<string, SerializedProfessor<T>>> {
    return _.keyBy(
      instances.map((instance) => {
        return this._bulkSerializeProf(this._serializeProf(instance));
      }),
      (res) => res.employee.id
    );
  }

  _bulkSerializeProf(prof: T): SerializedProfessor<T> {
    return {
      employee: prof,
      type: "employee",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _serializeProf(prof: PrismaProfessor): T {
    throw new Error("serializeProf not implemented");
  }
}

export default ProfSerializer;
