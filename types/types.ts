/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

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
  start: number;
  end: number;
}

export const NEU_COLLEGE = "NEU";
export const CPS_COLLEGE = "CPS";
export const LAW_COLLEGE = "LAW";

export type CollegeNames = "NEU" | "CPS" | "LAW";

export interface Employee {
  name: string;
  firstName: string;
  lastName: string;
  primaryDepartment?: string;
  primaryRole?: string;
  phone?: string;
  emails: string[];
  url?: string;
  streetAddress?: string;
  personalSite?: string;
  googleScholarId?: string;
  bigPictureUrl?: string;
  pic?: string;
  link?: string;
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
  campus: string;
  honors: boolean;
  url: string;
  profs: string[];
  meetings: BackendMeeting[];
}
