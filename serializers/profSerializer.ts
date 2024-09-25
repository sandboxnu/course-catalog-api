/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { Professor as PrismaProfessor } from "@prisma/client";
import { SerializedProfessor } from "../types/serializerTypes";

class ProfSerializer<T extends Partial<PrismaProfessor>> {
  async bulkSerialize(
    instances: PrismaProfessor[]
  ): Promise<Record<string, SerializedProfessor<T>>> {
    const result: Record<string, SerializedProfessor<T>> = {};
    instances.forEach((instance) => {
      const serialProf = this._bulkSerializeProf(this._serializeProf(instance));
      result[serialProf.employee.id] = serialProf;
    });
    return result;
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
