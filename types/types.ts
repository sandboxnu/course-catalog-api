/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

// A block of meetings, ex: "Tuesdays+Fridays, 9:50-11:30am"
import { ParsedTermSR } from "./scraperTypes";
import { Prisma } from "@prisma/client";

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

// A co or pre requisite object.
export type Requisite = string | BooleanReq | CourseReq;

export interface BooleanReq {
  type: "and" | "or";
  values: Requisite[];
}

export interface CourseReq {
  classId: string;
  subject: string;
  missing?: true;
}

export function isBooleanReq(req: Requisite): req is BooleanReq {
  return (req as BooleanReq).type !== undefined;
}

export function isCourseReq(req: Requisite): req is CourseReq {
  return (req as CourseReq).classId !== undefined;
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
}

export interface CourseRef {
  subject: string;
  termId: string;
  classId: string;
}

export interface Dump {
  termDump?: ParsedTermSR;
  profDump?: Employee[];
  destroy?: boolean;
  currentTermInfos?: TermInfo[];
}

export type BulkUpsertInput =
  | Prisma.SectionCreateInput
  | Prisma.CourseCreateInput
  | Prisma.ProfessorCreateInput;

export type SingleTransformFunction = (any) => string;
export type ArrayTransformFunction = (
  any,
  string,
  SingleTransformFunction
) => string;
export type TransformFunction =
  | SingleTransformFunction
  | ArrayTransformFunction;

export type EmptyObject = Record<string, never>;
