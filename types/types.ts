/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { ParsedTermSR } from "./scraperTypes";
import { Prisma } from "@prisma/client";
import keys from "../utils/keys";

/**
 * Converts a {@link MeetingTime} to a format compatible with Prisma.
 *
 * This doesn't do much at the moment, but it's useful for future-proofing.
 */
function convertMeetingTimeToPrismaType(
  meeting: MeetingTime,
): Prisma.InputJsonObject {
  return { ...meeting };
}

/**
 * Converts a single {@link BackendMeeting} to a format compatible with Prisma.
 */
export function convertBackendMeetingToPrismaType(
  meeting: BackendMeeting,
): Prisma.InputJsonObject {
  // Essentially, this takes a object with keys and values, and replaces every value with fn(value).
  // That `fn`, in this case, is the `convertMeetingTimeToDatabaseFormat` function.
  const times: Prisma.InputJsonObject = Object.fromEntries(
    // `entries` takes an object and converts it to an array of [key, value] pairs.
    // `fromEntries` does the opposite
    // So, we convert to entries, transform the values, then convert back to an object
    Object.entries(meeting.times).map(([key, val]) => {
      return [key, val.map((v) => convertMeetingTimeToPrismaType(v))];
    }),
  );
  return { ...meeting, times };
}

/**
 * Converts a {@link BackendMeeting} array to a format compatible with Prisma.
 */
export function convertBackendMeetingsToPrismaType(
  meetings?: BackendMeeting[],
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (meetings === undefined) {
    return Prisma.DbNull;
  }

  return meetings.map((val) => convertBackendMeetingToPrismaType(val));
}
// A block of meetings, ex: "Tuesdays+Fridays, 9:50-11:30am"
export interface BackendMeeting {
  startDate: number;
  endDate: number;
  where: string;
  type: string;
  times: Partial<
    Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", MeetingTime[]>
  >;
}

// A single meeting time, ex: "9:50-11:30am"
export interface MeetingTime {
  start: number | string;
  end: number | string;
}

export interface FacultyMeetingTime {
  beginTime: string;
  building: string;
  buildingDescription: string;
  campus: string;
  campusDescription: string;
  category: string;
  class: string;
  courseReferenceNumber: string;
  creditHourSession: number;
  endDate: string;
  endTime: string;
  friday: boolean;
  hoursWeek: number;
  meetingScheduleType: string;
  meetingType: string;
  meetingTypeDescription: string;
  monday: boolean;
  room: string;
  saturday: boolean;
  startDate: string;
  sunday: boolean;
  term: string;
  thursday: boolean;
  tuesday: boolean;
  wednesday: boolean;
}

export const NEU_COLLEGE = "NEU";
export const CPS_COLLEGE = "CPS";
export const LAW_COLLEGE = "LAW";

export type CollegeNames = "NEU" | "CPS" | "LAW";

export interface EmployeeRequestResponse {
  RecordNumber: string;
  LastName: string;
  FirstName: string;
  LongPositionTitle?: string;
  PositionTitle?: string;
  Department: string;
  PhoneNumber: string;
  CampusAddress: string;
  Email: string;
  SecondaryDivision: string;
  SecondaryDepartment: string;
  PreferredFirstName: string;
}

export interface Employee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  primaryDepartment?: string;
  primaryRole?: string;
  phone?: string;
  email?: string;
  officeRoom?: string;
}

// A course within a semester
export interface Course {
  host: string;
  termId: string;
  subject: string;
  classId: string;
  classAttributes: string[];
  desc: string;
  prettyUrl: string;
  name: string;
  url: string;
  lastUpdateTime: number;
  maxCredits: number;
  minCredits: number;
  coreqs: Requisite;
  prereqs: Requisite;
  feeAmount: number;
  feeDescription: string;
  sections?: Section[];
}

/**
 * Converts an optional {@link Requisite} to a format compatible with Prisma.
 */
export function convertRequisiteToNullablePrismaType(
  req: Requisite | undefined,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (req === undefined) {
    return Prisma.DbNull;
  }

  return convertRequisiteToPrismaType(req);
}

/**
 * Converts a {@link Requisite} to a format compatible with Prisma.
 *
 * Currently, this function does little. It's essentially a way to tell Typescript, "yeah, they're the same types".
 * However, this is useful because it allows us to easily change the format of the requisite in the future.
 */
export function convertRequisiteToPrismaType(
  req: Requisite,
): Prisma.InputJsonValue {
  if (typeof req === "string") {
    return req;
  } else if ("classId" in req) {
    return req;
  } else {
    return {
      ...req,
      values: req.values.map((val) => convertRequisiteToPrismaType(val)),
    };
  }
}

// A co or pre requisite object.
export type Requisite = string | BooleanReq | CourseReq;

export type BooleanReq = {
  type: "and" | "or";
  values: Requisite[];
};

export type CourseReq = {
  classId: string;
  subject: string;
  missing?: true;
};

export function isBooleanReq(req: Requisite): req is BooleanReq {
  return (req as BooleanReq).type !== undefined;
}

export function isCourseReq(req: Requisite): req is CourseReq {
  return (req as CourseReq).classId !== undefined;
}

/**
 * Converts one of our section types to a type compatible with the format required by Prisma.
 * The converted section is ready for insertion to our database.
 */
export function convertSectionToPrismaType(
  secInfo: Section,
): Prisma.SectionCreateInput {
  // Strip out the keys that Prisma doesn't recognize
  const {
    classId: _classId,
    termId: _termId,
    subject: _subject,
    host: _host,
    ...cleanSecInfo
  } = secInfo;

  return {
    ...cleanSecInfo,
    id: `${keys.getSectionHash(secInfo)}`,
    meetings: convertBackendMeetingsToPrismaType(secInfo.meetings),
    lastUpdateTime: new Date(secInfo.lastUpdateTime),
    course: {
      // This links our section with the course matching the given info.
      // This requires that the course already exists! We check this earlier on.
      // If not, this will error.
      connect: {
        uniqueCourseProps: {
          classId: secInfo.classId,
          termId: secInfo.termId,
          subject: secInfo.subject,
        },
      },
    } as Prisma.CourseCreateNestedOneWithoutSectionsInput,
  };
}

// A section of a course
export interface Section {
  host: string;
  termId: string;
  subject: string;
  classId: string;
  classType: string;
  crn: string;
  seatsCapacity: number;
  seatsRemaining: number;
  waitCapacity: number;
  waitRemaining: number;
  lastUpdateTime: number;
  campus: string;
  honors: boolean;
  url: string;
  profs: string[];
  meetings: BackendMeeting[];
}

export interface TermInfo {
  termId: string;
  subCollege: string;
  text: string;
  active: boolean;
}

export interface CourseRef {
  subject: string;
  termId: string;
  classId: string;
}

export interface Dump {
  termDump?: ParsedTermSR;
  profDump?: Employee[];
  deleteOutdatedData?: boolean;
  allTermInfos?: TermInfo[];
}

export type BulkUpsertInput =
  | Prisma.SectionCreateInput
  | Prisma.CourseCreateInput
  | Prisma.ProfessorCreateInput;

export type SingleTransformFunction = (arg0: any) => string;
export type ArrayTransformFunction = (
  arg0: any,
  arg1: string,
  arg2: SingleTransformFunction,
) => string;
export type TransformFunction =
  | SingleTransformFunction
  | ArrayTransformFunction;

export type EmptyObject = Record<string, never>;
