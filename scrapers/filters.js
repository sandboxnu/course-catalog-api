const filters = {
  campus: (campus) => true,
  subject: (subject) => ["CS"].includes(subject),
  courseNumber: (courseNumber) => courseNumber >= 2500,
  truncate: true,
};

export default filters;
