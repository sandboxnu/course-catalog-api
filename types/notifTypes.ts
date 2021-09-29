export interface UserInfo {
  phoneNumber: string;
  courseIds: string[];
  sectionIds: string[];
}

// Stores information for all changes to a course or section
export interface NotificationInfo {
  updatedCourses: CourseNotificationInfo[];
  updatedSections: SectionNotificationInfo[];
}

// marks new sections being added to a Course
export interface CourseNotificationInfo {
  subject: string;
  courseId: string;
  termId: string;
  courseHash: string;
  numberOfSectionsAdded: number;
  campus: string;
}

// marks seats becoming available in a section
export interface SectionNotificationInfo {
  subject: string;
  courseId: string;
  sectionHash: string;
  termId: string;
  seatsRemaining: number;
  crn: string;
  campus: string;
}
