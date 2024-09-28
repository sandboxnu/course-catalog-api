/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { Professor as PrismaProfessor } from "@prisma/client";
import { SerializedProfessor } from "../types/serializerTypes";

class ProfSerializer<T extends Partial<PrismaProfessor>> {
  static async bulkSerialize(
    instances: PrismaProfessor[]
  ): Promise<Record<string, SerializedProfessor<Partial<PrismaProfessor>>>> {
    const result: Record<
      string,
      SerializedProfessor<Partial<PrismaProfessor>>
    > = {};
    instances.forEach((instance) => {
      const serialProf = this._bulkSerializeProf(this._serializeProf(instance));
      result[serialProf.employee.id] = serialProf;
    });
    return result;
  }

  static _bulkSerializeProf(
    prof: Partial<PrismaProfessor>
  ): SerializedProfessor<Partial<PrismaProfessor>> {
    return {
      employee: prof,
      type: "employee",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static _serializeProf(prof: PrismaProfessor): Partial<PrismaProfessor> {
    throw new Error("serializeProf not implemented");
  }
}

export default ProfSerializer;
