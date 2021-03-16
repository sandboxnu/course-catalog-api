const filters = {
  subject: (subject) => ["EEMB"].includes(subject),
  courseNumber: (courseNumber) => courseNumber >= 3000,
  truncate: true,
  includeCourseRefs: true,
};

export default filters;
