import {
  Course as PrismaCourse,
  Section as PrismaSection,
  Professor as PrismaProfessor,
} from "@prisma/client";
import { BackendMeeting } from "./types";

export interface PrismaCourseWithSections extends PrismaCourse {
  sections?: PrismaSection[];
}

export interface SerializedSection
  extends Omit<PrismaSection, "lastUpdateTime" | "meetings"> {
  lastUpdateTime: number;
  meetings: BackendMeeting[];
}

export type FinishedSerializedSection = Omit<
  SerializedSection,
  "id" | "classHash"
>;

export type SerializedProfessor<T> = {
  employee: T;
  type: string;
};

export type SerializedCourse<C, S> = {
  type: "class";
  class: C;
  sections: S[];
};

export type ESProfessor = Pick<PrismaProfessor, "name" | "email" | "phone">;
export type ESCourse = Pick<
  PrismaCourse,
  "host" | "name" | "subject" | "classId" | "termId" | "nupath"
>;
export type ESSection = Pick<
  PrismaSection,
  "profs" | "classType" | "crn" | "campus"
>;
