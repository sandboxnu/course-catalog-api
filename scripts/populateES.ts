/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 *
 * script to fill elasticsearch by quering postgres
 */
import { Course, Professor } from "@prisma/client";

import elastic from "../utils/elastic";
import prisma from "../services/prisma";
import ElasticCourseSerializer from "../serializers/elasticCourseSerializer";
import ElasticProfSerializer from "../serializers/elasticProfSerializer";
import macros from "../utils/macros";

export async function bulkUpsertCourses(courses: Course[]): Promise<void> {
  // FIXME this pattern is bad
  const serializedCourses = await new ElasticCourseSerializer().bulkSerialize(
    courses,
    true
  );
  return elastic.bulkIndexFromMap(elastic.CLASS_INDEX, serializedCourses);
}

export async function bulkUpsertProfs(profs: Professor[]): Promise<void> {
  const serializedProfs = await new ElasticProfSerializer().bulkSerialize(
    profs
  );
  return elastic.bulkIndexFromMap(elastic.EMPLOYEE_INDEX, serializedProfs);
}

export async function populateES(): Promise<void> {
  const [courses, professors] = await Promise.all([
    prisma.course.findMany(),
    prisma.professor.findMany(),
  ]);
  await Promise.all([bulkUpsertCourses(courses), bulkUpsertProfs(professors)]);
}

if (require.main === module) {
  macros.log(
    `Populating ES at ${macros.getEnvVariable(
      "elasticURL"
    )} from Postgres at ${macros.getEnvVariable("dbHost")}`
  );
  (async () => {
    await populateES();
    macros.log("Success! Closing elastic client and exiting.");
    elastic.closeClient();
    process.exit();
  })().catch((e) => macros.error(e));
}
