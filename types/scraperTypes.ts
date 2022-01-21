import { FacultyMeetingTime, Requisite, Section } from "./types";

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

export interface ParsedCourseSR {
  host: string;
  termId: string;
  subject: string;
  classId: string;
  classAttributes: string[];
  nupath: any[];
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
