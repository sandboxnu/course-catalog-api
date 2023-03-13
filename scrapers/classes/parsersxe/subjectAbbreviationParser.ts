/* eslint-disable @typescript-eslint/no-use-before-define */
/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
import he from "he";
import macros from "../../../utils/macros.js";
import Request from "../../request.js";
import { SubjectDescription } from "../../../types/scraperTypes.js";

const request = new Request("subjectAbberviationParser");

/**
 * Get the subject abberviations for use in parsing prereqs
 */
export const getSubjectAbbreviations = _.memoize(async (termId: string) => {
  macros.log(
    `SubjectAbbreviationParser: Not memoized. Scraping term ${termId}`
  );
  const subjectResponse = await requestSubjects(termId);
  return createDescriptionTable(subjectResponse);
});

export const getSubjectDescriptions = _.memoize(async (termId: string) => {
  const subjectResponse = await requestSubjects(termId);
  return createAbbrTable(subjectResponse);
});

async function requestSubjects(termId: string): Promise<SubjectDescription[]> {
  const MAX = 500; // If there are more than 500 THIS WILL BREAK. Would make it smarter but not worth it rn.
  const URL =
    "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearch/get_subject";
  const subjectUrl = `${URL}?searchTerm=&term=${termId}&offset=1&max=${MAX}`;
  const response = await request.get(subjectUrl, {
    json: true,
  });

  if (response.statusCode !== 200) {
    macros.error(`Problem with request for subjects ${subjectUrl}`);
  }
  return response.body;
}

function createDescriptionTable(
  subjects: SubjectDescription[]
): Record<string, string> {
  const mappedSubjects = subjects.map((subject) => {
    return {
      subjectCode: subject.code,
      description: he.decode(subject.description),
    };
  });

  const mappedByDesc = _.keyBy(mappedSubjects, "description");
  return _.mapValues(mappedByDesc, "subjectCode");
}

function createAbbrTable(
  subjects: SubjectDescription[]
): Record<string, string> {
  const mappedSubjects = subjects.map((subject) => {
    return {
      description: he.decode(subject.description) as string,
      subjectCode: subject.code,
    };
  });

  const mappedByCode = _.keyBy(mappedSubjects, "subjectCode");
  return _.mapValues(mappedByCode, "description");
}

// Export for testing https://philipwalton.com/articles/how-to-unit-test-private-functions-in-javascript/
export {
  createDescriptionTable as _createDescriptionTable,
  createAbbrTable as _createAbbrTable,
  requestSubjects as _requestSubjects,
};
