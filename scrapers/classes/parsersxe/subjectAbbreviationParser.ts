/* eslint-disable @typescript-eslint/no-use-before-define */
/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import he from "he";
import macros from "../../../utils/macros";
import Request from "../../request";
import { SubjectDescription } from "../../../types/scraperTypes";

const request = new Request("subjectAbberviationParser");

/**
 * Get the subject abberviations for use in parsing prereqs
 */
export const getSubjectAbbreviations = (() => {
  const cache: Record<string, Record<string, string>> = {};

  return async (termId: string): Promise<Record<string, string>> => {
    if (cache[termId]) {
      return cache[termId] as Record<string, string>;
    }
    macros.log(
      `SubjectAbbreviationParser: Not memoized. Scraping term ${termId}`
    );
    const subjectResponse = await requestSubjects(termId);
    const result = createDescriptionTable(subjectResponse); // Ensure this returns Record<string, string>
    cache[termId] = result;

    return result as Record<string, string>; // Assert the type
  };
})();

export const getSubjectDescriptions = (() => {
  const cache: Record<string, unknown> = {};
  return async (termId: string) => {
    if (cache[termId]) {
      return cache[termId];
    }
    const subjectResponse = await requestSubjects(termId);
    const result = createAbbrTable(subjectResponse);
    cache[termId] = result;

    return result;
  };
})();

async function requestSubjects(termId: string): Promise<SubjectDescription[]> {
  const MAX = 500; // If there are more than 500 THIS WILL BREAK. Would make it smarter but not worth it rn.
  const URL =
    "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearch/get_subject";
  const subjectUrl = `${URL}?searchTerm=&term=${termId}&offset=1&max=${MAX}`;
  const response = await request.get(subjectUrl);

  if (response.statusCode !== 200) {
    macros.error(`Problem with request for subjects ${subjectUrl}`);
  }
  return JSON.parse(response.body);
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

  const mappedByDesc = mappedSubjects.reduce((acc, obj) => {
    acc[obj.description] = obj;
    return acc;
  }, {});
  return ((obj, prop) => {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, value[prop]])
    );
  })(mappedByDesc, "subjectCode");
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

  const mappedByCode = mappedSubjects.reduce((acc, obj) => {
    acc[obj.subjectCode] = obj;
    return acc;
  }, {});
  return ((obj, prop) => {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, value[prop]])
    );
  })(mappedByCode, "description");
}

// Export for testing https://philipwalton.com/articles/how-to-unit-test-private-functions-in-javascript/
export {
  createDescriptionTable as _createDescriptionTable,
  createAbbrTable as _createAbbrTable,
  requestSubjects as _requestSubjects,
};
