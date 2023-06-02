import { Prisma } from "@prisma/client";
import {
  FacultyMeetingTime,
  Requisite,
  Section,
  convertRequisiteToNullablePrismaType,
  convertRequisiteToPrismaType,
} from "./types";
import { Course as PrismaCourse } from "@prisma/client";
import keys from "../utils/keys";

export interface CourseSR {
  id: number;
  termEffective: string;
  courseNumber: string;
  subject: string;
  subjectCode: string;
  college: string;
  collegeCode: string;
  department: string;
  departmentCode: string;
  courseTitle: string;
  attributes?: string;
  lectureHourLow?: number;
  billHourLow: number;
  description: string;
  subjectDescription: string;
  courseDescription: string;
  creditHourHigh?: number;
  creditHourLow?: number;
  termStart: string;
  termEnd: string;
  preRequisiteCheckMethodCde: string;
  anySections?: boolean;
}

/**
 * Converts one of our course types to a type compatible with the format required by Prisma.
 * The converted course is ready for insertion to our database.
 */
export function convertCourseToPrismaType(
  classInfo: ParsedCourseSR
): Prisma.CourseCreateInput {
  // Strip out the keys that Prisma doesn't recognize
  const {
    desc: _desc,
    college: _college,
    modifiedInProcessor: _m,
    ...cleanClassInfo
  } = classInfo;

  return {
    ...cleanClassInfo,
    id: keys.getClassHash(classInfo),
    description: classInfo.desc,
    minCredits: Math.floor(classInfo.minCredits),
    maxCredits: Math.floor(classInfo.maxCredits),
    prereqs: convertRequisiteToNullablePrismaType(classInfo.prereqs),
    coreqs: convertRequisiteToNullablePrismaType(classInfo.coreqs),
    optPrereqsFor: (classInfo.optPrereqsFor?.values ?? []).map((val) =>
      convertRequisiteToPrismaType(val)
    ),
    prereqsFor: (classInfo.prereqsFor?.values ?? []).map((val) =>
      convertRequisiteToPrismaType(val)
    ),
    lastUpdateTime: new Date(classInfo.lastUpdateTime),
  };
}

/**
 * Converts one of our course types to a type compatible with the format required by Prisma.
 * The converted course is ready for insertion to our database.
 */
export function convertCourseFromPrismaType(
  classInfo: PrismaCourse
): ParsedCourseSR {
  return {
    ...classInfo,
    desc: classInfo.description,
    college: "",
    lastUpdateTime: classInfo.lastUpdateTime.getUTCDate(),
    // TODO: 2023-05, this shouldn't be just cast blindly (but I don't have time to do it rn ;)
    prereqs: classInfo.prereqs as Requisite,
    coreqs: classInfo.coreqs as Requisite,
    prereqsFor: classInfo.prereqsFor as unknown as PrereqsFor,
    optPrereqsFor: classInfo.optPrereqsFor as unknown as PrereqsFor,
  };
}

export interface ParsedCourseSR {
  host: string;
  termId: string;
  subject: string;
  classId: string;
  classAttributes: string[];
  nupath: string[];
  desc: string;
  prettyUrl: string;
  name: string;
  url: string;
  lastUpdateTime: number;
  maxCredits: number;
  minCredits: number;
  college: string;
  feeAmount: number;
  feeDescription: string;
  modifiedInProcessor?: boolean;
  prereqs?: Requisite;
  coreqs?: Requisite;
  optPrereqsFor?: PrereqsFor;
  prereqsFor?: PrereqsFor;
}

export interface PrereqsFor {
  values: Requisite[];
}

export interface SectionSR {
  id: number;
  term: string;
  termDesc: string;
  courseReferenceNumber: string;
  partOfTerm: string;
  courseNumber: string;
  subject: string;
  subjectDescription: string;
  sequenceNumber: string;
  campusDescription: string;
  scheduleTypeDescription: string;
  courseTitle: string;
  creditHours: number | null;
  maximumEnrollment: number;
  enrollment: number;
  seatsAvailable: number;
  waitCapacity: number;
  waitCount: number;
  waitAvailable: number;
  crossList: any;
  crossListCapacity: number | null;
  crossListCount: number | null;
  crossListAvailable: number | null;
  creditHourHigh: number | null;
  creditHourLow: number | null;
  creditHourIndicator: any;
  openSection: boolean;
  linkIdentifier: any;
  isSectionLinked: boolean;
  subjectCourse: string;
  faculty: Faculty[];
  meetingsFaculty: MeetingsFaculty[];
  reservedSeatSummary: any;
  sectionAttributes: SectionAttribute[];
}

export interface ParsedTermSR {
  classes: ParsedCourseSR[];
  sections: Section[];
  subjects: Record<string, string>;
}

export interface Faculty {
  bannerId: string;
  category: any;
  class: string;
  courseReferenceNumber: string;
  displayName: string;
  emailAddress: string | null;
  primaryIndicator: boolean;
  term: string;
}

export interface MeetingsFaculty {
  category: string;
  class: string;
  courseReferenceNumber: string;
  faculty: any[];
  meetingTime: FacultyMeetingTime;
  term: string;
}

export interface SectionAttribute {
  class: string;
  code: string;
  courseReferenceNumber: string;
  description: string;
  isZTCAttribute: boolean;
  termCode: string;
}

export interface SubjectDescription {
  code: string;
  description: string;
}
